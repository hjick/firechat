import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';
import type { FileUploader, UploadResult, UploadProgress } from '../types/uploader';

export class FirebaseStorageUploader implements FileUploader {
  constructor(private readonly storage: FirebaseStorage) {}

  async upload(
    file: File | { uri: string; name?: string; type?: string },
    path: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    const storageRef = ref(this.storage, path);

    // Handle browser File object
    if (file instanceof File) {
      return new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);

        task.on(
          'state_changed',
          (snapshot) => {
            onProgress?.({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              progress: Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              ),
            });
          },
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve({
              url,
              path,
              size: task.snapshot.totalBytes,
              mimeType: file.type || 'application/octet-stream',
            });
          },
        );
      });
    }

    // Handle React Native { uri } object
    const response = await fetch(file.uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, blob);

      task.on(
        'state_changed',
        (snapshot) => {
          onProgress?.({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress: Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            ),
          });
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            path,
            size: task.snapshot.totalBytes,
            mimeType: file.type || blob.type || 'application/octet-stream',
          });
        },
      );
    });
  }

  async delete(path: string): Promise<void> {
    const storageRef = ref(this.storage, path);
    await deleteObject(storageRef);
  }
}
