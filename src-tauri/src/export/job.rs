//! One running FFmpeg. It writes to a partial file, renamed only when complete, so a failed
//! export never leaves something that looks finished.

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex as StdMutex};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::Mutex;

use super::recipe::{ExportSpec, arguments};
use crate::media::proxy::{Tools, command};

/// Lines of FFmpeg's complaints kept to explain a failure.
const TAIL_LINES: usize = 6;

/// `clip.mp4` next to itself as `clip.partial.mp4`.
fn partial_of(output: &Path) -> PathBuf {
    let extension = output.extension().and_then(|e| e.to_str()).unwrap_or("mp4");
    output.with_extension(format!("partial.{extension}"))
}

/// An export FFmpeg is working on.
pub struct Job {
    /// Bytes of one frame; 0 for a sound-only export.
    pub frame_bytes: usize,
    pub partial: PathBuf,
    output: PathBuf,
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Child>,
    tail: Arc<StdMutex<VecDeque<String>>>,
}

impl Job {
    /// Starts FFmpeg. With a picture, it waits for frames on stdin.
    pub fn start(tools: &Tools, spec: &ExportSpec, card: Option<&str>) -> Result<Self, String> {
        let output = PathBuf::from(&spec.output);
        let partial = partial_of(&output);
        let picture = spec.format.has_picture();
        let mut cmd = command(&tools.ffmpeg);
        cmd.args(arguments(spec, &partial, card))
            .stdin(if picture {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Could not start FFmpeg: {e}"))?;

        let tail = Arc::new(StdMutex::new(VecDeque::new()));
        if let Some(stderr) = child.stderr.take() {
            let tail = tail.clone();
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if let Ok(mut kept) = tail.lock() {
                        kept.push_back(line);
                        if kept.len() > TAIL_LINES {
                            kept.pop_front();
                        }
                    }
                }
            });
        }
        let stdin = child.stdin.take();
        let frame_bytes = if picture {
            spec.width as usize * spec.height as usize * 4
        } else {
            0
        };
        Ok(Self {
            frame_bytes,
            partial,
            output,
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            tail,
        })
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
            return Err(self.complaint());
        }
        Ok(())
    }

    /// What FFmpeg said last.
    fn complaint(&self) -> String {
        let said = self.tail.lock().ok().and_then(|kept| kept.back().cloned());
        said.unwrap_or_else(|| "FFmpeg stopped unexpectedly".to_owned())
    }

    /// Ends the input, waits for FFmpeg and moves the file into place.
    pub async fn finish(&self) -> Result<PathBuf, String> {
        // Dropping the pipe tells FFmpeg there are no more frames.
        self.stdin.lock().await.take();
        let status = self.child.lock().await.wait().await;
        let succeeded = status.is_ok_and(|status| status.success());
        if !succeeded {
            let _ = tokio::fs::remove_file(&self.partial).await;
            return Err(self.complaint());
        }
        if let Err(e) = tokio::fs::rename(&self.partial, &self.output).await {
            let _ = tokio::fs::remove_file(&self.partial).await;
            return Err(format!("Could not save the file: {e}"));
        }
        Ok(self.output.clone())
    }

    /// Stops FFmpeg and removes what it wrote.
    pub async fn cancel(&self) {
        // Killing first breaks the pipe, so a frame being written lets go of it.
        let _ = self.child.lock().await.kill().await;
        self.stdin.lock().await.take();
        let _ = tokio::fs::remove_file(&self.partial).await;
    }
}
