//! The encoders (proxies, masters, derived files, image frames) running now, so quitting can stop
//! them. They hold their FFmpeg in a local, so nothing else can reach it: each watches
//! [`Encoders::stopping`], kills its FFmpeg and fails with "Cancelled", which makes its caller
//! remove its partial file as for any failure.

use std::sync::LazyLock;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use tokio_util::sync::CancellationToken;

/// The encoders of this process (a static: they run from free functions, with no state to hold
/// them).
pub(super) static ENCODERS: LazyLock<Encoders> = LazyLock::new(Encoders::default);

/// How long quitting waits for the encoders to kill their FFmpeg and clean up.
const PATIENCE: Duration = Duration::from_secs(3);

#[derive(Default)]
pub(super) struct Encoders {
    stopping: CancellationToken,
    running: AtomicUsize,
}

/// One encoder running; it counts until dropped.
pub(super) struct Running<'a>(&'a AtomicUsize);

impl Drop for Running<'_> {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

impl Encoders {
    /// Counts an encoder in, or `None` when the app is quitting and none may start.
    pub(super) fn enter(&self) -> Option<Running<'_>> {
        self.running.fetch_add(1, Ordering::SeqCst);
        let running = Running(&self.running);
        (!self.stopping.is_cancelled()).then_some(running)
    }

    /// Resolves once the app is quitting.
    pub(super) async fn stopping(&self) {
        self.stopping.cancelled().await;
    }

    /// Stops every encoder and waits (a few seconds at most) until each has killed its FFmpeg.
    pub(super) async fn stop(&self) {
        self.stopping.cancel();
        let _ = tokio::time::timeout(PATIENCE, async {
            while self.running.load(Ordering::SeqCst) > 0 {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await;
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    /// Quitting must kill an FFmpeg that would run for minutes, and refuse to start another.
    #[tokio::test]
    async fn stopping_kills_a_running_child() {
        let encoders = std::sync::Arc::new(Encoders::default());
        let mut sleeper = tokio::process::Command::new("sleep")
            .arg("30")
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let watcher = encoders.clone();
        let task = tokio::spawn(async move {
            let _running = watcher.enter().unwrap();
            tokio::select! {
                _ = sleeper.wait() => false,
                () = watcher.stopping() => {
                    sleeper.kill().await.unwrap();
                    true
                }
            }
        });
        tokio::time::sleep(Duration::from_millis(100)).await;
        encoders.stop().await;
        assert!(
            task.await.unwrap(),
            "the child was killed, not left running"
        );
        assert_eq!(encoders.running.load(Ordering::SeqCst), 0);
        assert!(encoders.enter().is_none());
    }
}
