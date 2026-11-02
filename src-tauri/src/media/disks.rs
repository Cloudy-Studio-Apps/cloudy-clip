//! The disks shown on the Media page.

use serde::Serialize;
use sysinfo::Disks;

use crate::error::AppError;

/// A mounted disk.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    name: String,
    mount_point: String,
    total_bytes: u64,
    free_bytes: u64,
}

const PSEUDO_FILESYSTEMS: [&str; 10] = [
    "tmpfs", "devtmpfs", "squashfs", "overlay", "proc", "sysfs", "efivarfs", "autofs", "ramfs",
    "cgroup2",
];
const SYSTEM_MOUNTS: [&str; 6] = ["/boot", "/dev", "/proc", "/run", "/snap", "/sys"];

fn is_real(file_system: &str, mount: &str) -> bool {
    !PSEUDO_FILESYSTEMS.contains(&file_system)
        && !SYSTEM_MOUNTS
            .iter()
            .any(|system| mount == *system || mount.starts_with(&format!("{system}/")))
}

/// Lists what's mounted, leaving out pseudo filesystems.
#[tauri::command]
pub async fn media_list_disks() -> Result<Vec<DiskInfo>, AppError> {
    let disks = Disks::new_with_refreshed_list()
        .map_err(|e| AppError::Unavailable(format!("Could not list disks: {e}")))?;
    let mut list: Vec<DiskInfo> = disks
        .iter()
        .filter(|disk| {
            is_real(
                &disk.file_system().to_string_lossy(),
                &disk.mount_point().to_string_lossy(),
            )
        })
        .map(|disk| {
            let mount_point = disk.mount_point().to_string_lossy().into_owned();
            let name = disk.name().to_string_lossy().into_owned();
            DiskInfo {
                name: if name.is_empty() {
                    mount_point.clone()
                } else {
                    name
                },
                mount_point,
                total_bytes: disk.total_space(),
                free_bytes: disk.available_space(),
            }
        })
        .collect();
    list.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    list.dedup_by(|a, b| a.name == b.name && a.total_bytes == b.total_bytes);
    Ok(list)
}
