//! One running FFmpeg. It writes to partial files (the export, and its stems when it has some),
//! renamed only when all are complete, so a failed export never leaves something that looks
//! finished. A measurement (the sound module's analysis) runs as a job too, writing nothing.

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use tauri::async_runtime::JoinHandle;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::{Mutex, OnceCell};

use super::recipe::{Recipe, ScriptOption, arguments, partial_of, script_of};
use super::spec::ExportSpec;
use crate::media::proxy::{Tools, command};

/// Lines of FFmpeg's complaints kept to explain a failure.
const TAIL_LINES: usize = 6;
/// How often a waiting finish looks at FFmpeg. The child stays free, so a cancel can kill it.
const WAIT_POLL: Duration = Duration::from_millis(50);
/// How long FFmpeg gets to say why it stopped.
const LAST_WORDS: Duration = Duration::from_secs(2);
/// What FFmpeg says last on any failure; the reason is the line before.
const GENERIC_ENDING: &str = "Conversion failed!";

/// How this FFmpeg reads a filter graph from a file, by its `-version`. Unknown counts as new.
/// Asked once, without blocking the async runtime, and kept for the app's lifetime: the system
/// FFmpeg is found once too (`find_tools`).
pub async fn script_option(ffmpeg: &Path) -> ScriptOption {
    static FOUND: OnceCell<ScriptOption> = OnceCell::const_new();
    *FOUND
        .get_or_init(|| async {
            let output = command(ffmpeg).arg("-version").output().await.ok();
            let text = output.map(|o| String::from_utf8_lossy(&o.stdout).into_owned());
            ScriptOption::from_version_line(
                text.as_deref().and_then(|t| t.lines().next()).unwrap_or(""),
            )
        })
        .await
}

/// What hears each line a job's FFmpeg prints.
type Listener = Box<dyn FnMut(&str) + Send>;

/// An export FFmpeg is working on.
pub struct Job {
    /// Bytes of one frame; 0 for a sound-only export.
    pub frame_bytes: usize,
    /// What FFmpeg writes: the export's file first, then its stems'.
    pub partials: Vec<PathBuf>,
    /// The filter graph file of a long graph, removed with the partial files.
    script: Option<PathBuf>,
    /// Where each partial file goes once all are complete.
    outputs: Vec<PathBuf>,
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Child>,
    tail: Arc<StdMutex<VecDeque<String>>>,
    /// Reads FFmpeg's stderr; ends when FFmpeg does.
    reader: Mutex<Option<JoinHandle<()>>>,
    cancelled: AtomicBool,
}

impl Job {
    /// Starts FFmpeg. With a picture, it waits for frames on stdin. `option` is how this FFmpeg
    /// reads a long filter graph from a file (`script_option`).
    pub fn start(
        tools: &Tools,
        spec: &ExportSpec,
        card: Option<&str>,
        option: ScriptOption,
    ) -> Result<Self, String> {
        let stems = spec.stems.iter().map(|stem| stem.output.as_str());
        let outputs: Vec<PathBuf> = std::iter::once(spec.output.as_str())
            .chain(stems)
            .map(PathBuf::from)
            .collect();
        let partials: Vec<PathBuf> = outputs.iter().map(|output| partial_of(output)).collect();
        let partial = &partials[0];
        let picture = spec.format.has_picture();
        let recipe = arguments(spec, partial, card, option);
        let job = Self::spawn(tools, recipe, script_of(partial), picture, None)?;
        let frame_bytes = if picture {
            spec.width as usize * spec.height as usize * 4
        } else {
            0
        };
        Ok(Self {
            frame_bytes,
            partials,
            outputs,
            ..job
        })
    }

    /// Starts an FFmpeg that measures and writes no file (`recipe::measure_arguments`, with its
    /// long graph in `script`). Every line it prints goes to `listen` as it comes. It is
    /// cancelled as an export is; `measured` waits for it.
    pub fn measure(
        tools: &Tools,
        recipe: Recipe,
        script: PathBuf,
        listen: impl FnMut(&str) + Send + 'static,
    ) -> Result<Self, String> {
        Self::spawn(tools, recipe, script, false, Some(Box::new(listen)))
    }

    /// Runs `recipe`, its long graph written to `script` first, with frames on stdin when
    /// `frames`. Its stderr goes to `listen`, and its last lines are kept to explain a failure.
    fn spawn(
        tools: &Tools,
        recipe: Recipe,
        script: PathBuf,
        frames: bool,
        mut listen: Option<Listener>,
    ) -> Result<Self, String> {
        let script = recipe.script.as_ref().map(|_| script);
        if let (Some(file), Some(graph)) = (&script, &recipe.script) {
            std::fs::write(file, graph)
                .map_err(|e| format!("Could not write the filter graph: {e}"))?;
        }
        let mut cmd = command(&tools.ffmpeg);
        cmd.args(recipe.args)
            .stdin(if frames {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let mut child = cmd.spawn().map_err(|e| {
            if let Some(file) = &script {
                let _ = std::fs::remove_file(file);
            }
            format!("Could not start FFmpeg: {e}")
        })?;

        let tail = Arc::new(StdMutex::new(VecDeque::new()));
        let reader = child.stderr.take().map(|stderr| {
            let tail = tail.clone();
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if let Some(listen) = listen.as_mut() {
                        listen(&line);
                    }
                    if let Ok(mut kept) = tail.lock() {
                        kept.push_back(line);
                        if kept.len() > TAIL_LINES {
                            kept.pop_front();
                        }
                    }
                }
            })
        });
        let stdin = child.stdin.take();
        Ok(Self {
            frame_bytes: 0,
            partials: Vec::new(),
            script,
            outputs: Vec::new(),
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            tail,
            reader: Mutex::new(reader),
            cancelled: AtomicBool::new(false),
        })
    }

    /// Removes the filter graph file, if the export has one.
    async fn remove_script(&self) {
        if let Some(file) = &self.script {
            let _ = tokio::fs::remove_file(file).await;
        }
    }

    /// Hands one frame to FFmpeg. Returns once it took all of it, which paces the sender.
    pub async fn write_frame(&self, frame: &[u8]) -> Result<(), String> {
        if frame.len() != self.frame_bytes {
            return Err("A frame came in the wrong size".to_owned());
        }
        let mut stdin = self.stdin.lock().await;
        let Some(pipe) = stdin.as_mut() else {
            return Err("This export takes no more frames".to_owned());
        };
        if pipe.write_all(frame).await.is_err() {
            return Err(self.complaint().await);
        }
        Ok(())
    }

    /// Why FFmpeg stopped, once it has finished saying so.
    async fn complaint(&self) -> String {
        if let Some(reader) = self.reader.lock().await.take() {
            let _ = tokio::time::timeout(LAST_WORDS, reader).await;
        }
        let kept = self.tail.lock().ok();
        kept.and_then(|lines| {
            let reason = lines
                .iter()
                .rev()
                .find(|line| line.trim() != GENERIC_ENDING);
            reason.cloned()
        })
        .unwrap_or_else(|| "FFmpeg stopped unexpectedly".to_owned())
    }

    /// Waits for FFmpeg without holding the child, which `cancel` needs.
    async fn wait(&self) -> bool {
        loop {
            match self.child.lock().await.try_wait() {
                Ok(Some(status)) => return status.success(),
                Ok(None) => {}
                Err(_) => return false,
            }
            tokio::time::sleep(WAIT_POLL).await;
        }
    }

    /// Removes the partial files that are still there.
    async fn remove_partials(&self) {
        for partial in &self.partials {
            let _ = tokio::fs::remove_file(partial).await;
        }
    }

    /// Ends the input and waits for FFmpeg. Fails with why it stopped, or when it was cancelled.
    async fn ended(&self) -> Result<(), String> {
        // Dropping the pipe tells FFmpeg there are no more frames.
        self.stdin.lock().await.take();
        let succeeded = self.wait().await;
        self.remove_script().await;
        if self.cancelled.load(Ordering::SeqCst) {
            return Err("Cancelled".to_owned());
        }
        if !succeeded {
            self.remove_partials().await;
            return Err(self.complaint().await);
        }
        Ok(())
    }

    /// Waits for a measurement (`measure`) to end, and for every line it printed to be heard.
    pub async fn measured(&self) -> Result<(), String> {
        self.ended().await?;
        if let Some(reader) = self.reader.lock().await.take() {
            let _ = reader.await;
        }
        Ok(())
    }

    /// Ends the input, waits for FFmpeg and moves the files into place. Returns the export's.
    pub async fn finish(&self) -> Result<PathBuf, String> {
        self.ended().await?;
        if let Err(e) = self.publish().await {
            self.remove_partials().await;
            return Err(e);
        }
        Ok(self.outputs[0].clone())
    }

    /// Renames the partial files to their outputs, all or none: a file already there is set aside
    /// first, and put back if a later rename fails, so a failed job never leaves new files next
    /// to old ones.
    async fn publish(&self) -> Result<(), String> {
        let aside = |output: &PathBuf| {
            let mut name = output.clone().into_os_string();
            name.push(".replaced");
            PathBuf::from(name)
        };
        let mut done: Vec<(&PathBuf, Option<PathBuf>)> = Vec::new();
        let mut failure = None;
        for (partial, output) in self.partials.iter().zip(&self.outputs) {
            let kept = aside(output);
            let moved = tokio::fs::rename(output, &kept)
                .await
                .is_ok()
                .then_some(kept);
            if let Err(e) = tokio::fs::rename(partial, output).await {
                if let Some(kept) = moved {
                    let _ = tokio::fs::rename(&kept, output).await;
                }
                failure = Some(format!("Could not save {}: {e}", output.display()));
                break;
            }
            done.push((output, moved));
        }
        if let Some(message) = failure {
            for (output, kept) in done {
                let _ = tokio::fs::remove_file(output).await;
                if let Some(kept) = kept {
                    let _ = tokio::fs::rename(&kept, output).await;
                }
            }
            return Err(message);
        }
        for (_, kept) in done {
            if let Some(kept) = kept {
                let _ = tokio::fs::remove_file(kept).await;
            }
        }
        Ok(())
    }

    /// Stops FFmpeg and removes what it wrote.
    pub async fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        // Killing first breaks the pipe, so a frame being written lets go of it.
        let _ = self.child.lock().await.kill().await;
        self.stdin.lock().await.take();
        self.remove_script().await;
        self.remove_partials().await;
    }
}
