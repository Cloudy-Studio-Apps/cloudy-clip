//! Stable actor keys for connected MCP clients.
//!
//! Sessions come and go (rmcp drops an idle one after 300 s), but history, clocks and presence need
//! one identity per agent, so the webview only ever sees the key this map hands out.
//!
//! The server doesn't offer the stateless protocol (`SUPPORTED_VERSIONS` in `server.rs`), but a
//! client without a session id still gets a stable key: one per client name.

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How long a key must be silent before a new session of the same client may take it over.
const SESSION_EXPIRY: Duration = Duration::from_secs(300);

struct Actor {
    key: String,
    name: String,
    last_seen: Instant,
}

/// Maps sessions and client names to actor keys.
#[derive(Default)]
pub struct ActorMap {
    /// Actors with sessions. Clients without one are never among them.
    actors: Vec<Actor>,
    sessions: HashMap<String, String>,
    /// The one key of each client name that keeps no session.
    stateless: HashMap<String, String>,
    minted: usize,
}

impl ActorMap {
    /// The key of the client behind `session`, or of `name` for clients that keep no session. A
    /// new session takes over the longest-silent session key of the same client, else gets a new
    /// key.
    pub fn resolve(&mut self, session: Option<&str>, name: &str, now: Instant) -> String {
        let Some(session) = session else {
            if let Some(key) = self.stateless.get(name) {
                return key.clone();
            }
            let key = self.mint();
            self.stateless.insert(name.to_owned(), key.clone());
            return key;
        };
        let key = match self.sessions.get(session) {
            Some(key) => key.clone(),
            None => self.takeover(name, now).unwrap_or_else(|| {
                let key = self.mint();
                self.actors.push(Actor {
                    key: key.clone(),
                    name: name.to_owned(),
                    last_seen: now,
                });
                key
            }),
        };
        self.sessions.insert(session.to_owned(), key.clone());
        if let Some(actor) = self.actors.iter_mut().find(|a| a.key == key) {
            actor.last_seen = now;
        }
        key
    }

    /// The longest-silent key of a client, among those silent long enough to have expired.
    fn takeover(&self, name: &str, now: Instant) -> Option<String> {
        self.actors
            .iter()
            .filter(|a| a.name == name && now.duration_since(a.last_seen) >= SESSION_EXPIRY)
            .min_by_key(|a| a.last_seen)
            .map(|a| a.key.clone())
    }

    fn mint(&mut self) -> String {
        self.minted += 1;
        format!("agent-{}", self.minted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secs(n: u64) -> Duration {
        Duration::from_secs(n)
    }

    #[test]
    fn reuses_a_key_only_after_the_old_session_went_silent() {
        let mut actors = ActorMap::default();
        let t0 = Instant::now();
        let a = actors.resolve(Some("s1"), "Claude Code", t0);
        assert_eq!(actors.resolve(Some("s1"), "Claude Code", t0), a);
        let b = actors.resolve(Some("s2"), "Claude Code", t0 + secs(10));
        assert_ne!(a, b, "a second live client is a new actor");
        let c = actors.resolve(Some("s3"), "Claude Code", t0 + secs(400));
        assert_eq!(c, a, "a reconnect takes over the longest-silent key");
    }

    #[test]
    fn a_client_without_a_session_keeps_one_key_beside_session_keys() {
        let mut actors = ActorMap::default();
        let t0 = Instant::now();
        let a = actors.resolve(Some("s1"), "Claude Code", t0);
        let b = actors.resolve(Some("s2"), "Claude Code", t0 + secs(1));
        let first = actors.resolve(None, "Claude Code", t0 + secs(2));
        for n in 3..8 {
            assert_eq!(actors.resolve(None, "Claude Code", t0 + secs(n)), first);
        }
        assert_ne!(first, a);
        assert_ne!(first, b);
    }

    #[test]
    fn a_new_session_never_takes_a_key_without_a_session() {
        let mut actors = ActorMap::default();
        let t0 = Instant::now();
        let stateless = actors.resolve(None, "Claude Code", t0);
        let session = actors.resolve(Some("s1"), "Claude Code", t0 + secs(400));
        assert_ne!(session, stateless);
    }

    #[test]
    fn clients_without_a_session_share_a_key_by_name() {
        let mut actors = ActorMap::default();
        let t0 = Instant::now();
        assert_eq!(
            actors.resolve(None, "Codex", t0),
            actors.resolve(None, "Codex", t0)
        );
        assert_ne!(
            actors.resolve(None, "Codex", t0),
            actors.resolve(None, "Cursor", t0)
        );
    }
}
