export type DriveBackupFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

export type GoogleDriveAdapter = {
  listBackups: () => Promise<DriveBackupFile[]>;
  uploadBackup: (filename: string, payload: string) => Promise<DriveBackupFile>;
  downloadBackup: (fileId: string) => Promise<string>;
};

/** Folder created specifically for this project in the user's Drive. */
export const PROJECT_DRIVE_FOLDER_ID = "1Qrql348yLKgkKNEzRDYUwLAa1ylbEx8h";
export const PROJECT_BACKUPS_FOLDER_ID = "12qwZHYKcI7Zsg-m5gYOCCkzQc8Ynpthx";
export const PROJECT_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1Qrql348yLKgkKNEzRDYUwLAa1ylbEx8h";
export const PROJECT_BACKUPS_FOLDER_URL = "https://drive.google.com/drive/folders/12qwZHYKcI7Zsg-m5gYOCCkzQc8Ynpthx";

/**
 * Creates a short-lived Google Drive adapter from an OAuth access token.
 * The token is intentionally supplied by the host/connector and is never
 * written to localStorage, exported JSON, or React state.
 */
export function createGoogleDriveAdapter(accessToken: string, folderId?: string): GoogleDriveAdapter {
  if (!accessToken.trim()) throw new Error("Google Drive مجوز دسترسی ندارد");
  const headers = { Authorization: `Bearer ${accessToken}` };
  const q = folderId ? `'${folderId}' in parents and ` : "";
  return {
    async listBackups() {
      const params = new URLSearchParams({
        q: `${q}trashed = false and name contains 'accounting-workshop-backup'`,
        pageSize: "100",
        orderBy: "modifiedTime desc",
        fields: "files(id,name,mimeType,modifiedTime,size)",
      });
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers });
      if (!response.ok) throw new Error(`Google Drive: ${response.status}`);
      const data = (await response.json()) as { files?: DriveBackupFile[] };
      return data.files || [];
    },
    async uploadBackup(filename, payload) {
      const metadata = { name: filename, mimeType: "application/json", ...(folderId ? { parents: [folderId] } : {}) };
      const boundary = `accounting-${crypto.randomUUID()}`;
      const body = [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n`,
        `--${boundary}--`,
      ].join("");
      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size", {
        method: "POST",
        headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!response.ok) throw new Error(`Google Drive: ${response.status}`);
      return (await response.json()) as DriveBackupFile;
    },
    async downloadBackup(fileId) {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
      if (!response.ok) throw new Error(`Google Drive: ${response.status}`);
      return response.text();
    },
  };
}
