//! Stable actor keys for connected MCP clients.
//!
//! Sessions come and go (rmcp drops an idle one after 300 s, and newer protocol versions have
//! none), but history, clocks and presence need one identity per agent. So the webview only ever
//! sees the key this map hands out.

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
    actors: Vec<Actor>,
    sessions: HashMap<String, String>,
}

impl ActorMap {
    /// The key of the client behind `session` (or of `name`, for clients that keep no session).
    /// A new session takes over the longest-silent key of the same client, else gets a new key.
    pub fn resolve(&mut self, session: Option<&str>, name: &str, now: Instant) -> String {
        let known = match session {
            Some(session) => self.sessions.get(session).cloned(),
            None => self.by_name(name, Duration::ZERO, now),
        };
        let key = known
            .or_else(|| self.by_name(name, SESSION_EXPIRY, now))
            .unwrap_or_else(|| self.mint(name, now));
        if let Some(session) = session {
            self.sessions.insert(session.to_owned(), key.clone());
        }
        if let Some(actor) = self.actors.iter_mut().find(|a| a.key == key) {
            actor.last_seen = now;
        }
        key
    }

    /// The longest-silent key of a client, among those silent for at least `silent`.
    fn by_name(&self, name: &str, silent: Duration, now: Instant) -> Option<String> {
        self.actors
            .iter()
            .filter(|a| a.name == name && now.duration_since(a.last_seen) >= silent)
            .min_by_key(|a| a.last_seen)
            .map(|a| a.key.clone())
    }

    fn mint(&mut self, name: &str, now: Instant) -> String {
        let key = format!("agent-{}", self.actors.len() + 1);
        self.actors.push(Actor {
            key: key.clone(),
            name: name.to_owned(),
            last_seen: now,
        });
        key
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
