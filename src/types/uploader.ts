export interface UploadResult {
  /** The download URL of the uploaded file */
  url: string;
  /** Full storage path for deletion/reference */
  path: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the uploaded file */
  mimeType: string;
}

export interface UploadProgress {
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total bytes */
  totalBytes: number;
  /** Progress percentage 0-100 */
  progress: number;
}

export interface FileUploader {
  /**
   * Upload a file and return the download URL.
   * @param file - The file to upload (File in browser, { uri: string } in React Native)
   * @param path - Suggested storage path (e.g., "chat/roomId/filename.jpg")
   * @param onProgress - Optional progress callback
   */
  upload(
    file: File | { uri: string; name?: string; type?: string },
    path: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult>;

  /**
   * Delete a previously uploaded file.
   * @param path - The storage path returned from upload()
   */
  delete?(path: string): Promise<void>;
}
