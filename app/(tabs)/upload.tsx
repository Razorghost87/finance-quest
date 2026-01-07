import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { readFileAsArrayBuffer } from '@/lib/file-upload';
import { getGuestToken, getOrCreateGuestToken } from '@/lib/guest-token';
import { ensureSupabaseConfigured } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

export default function UploadScreen() {
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingGuest, setIsCheckingGuest] = useState(true);
  const [canUpload, setCanUpload] = useState(true);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  
  // Upload UX
  const [uploadProgress, setUploadProgress] = useState<number>(0); // 0-100 (client upload)
  const [uploadStage, setUploadStage] = useState<string>(''); // "Reading file", "Uploading", etc.

  useEffect(() => {
    checkGuestStatus();
  }, []);

  const checkGuestStatus = async () => {
    try {
      setIsCheckingGuest(true);
      const token = await getGuestToken();
      setGuestToken(token);

      // TEMPORARILY DISABLED FOR TESTING - Allow unlimited uploads
      setCanUpload(true);
      setIsCheckingGuest(false);
      return;

      // Original limit check (commented out for testing)
      // if (!token) {
      //   // New guest, can upload
      //   setCanUpload(true);
      //   setIsCheckingGuest(false);
      //   return;
      // }

      // // Check if guest can upload
      // const supabase = ensureSupabaseConfigured();
      // const { data, error } = await supabase.rpc('can_guest_upload', {
      //   p_guest_token: token,
      // });

      // if (error) {
      //   console.error('Error checking guest status:', error);
      //   // Allow upload if check fails (for development)
      //   setCanUpload(true);
      // } else {
      //   setCanUpload(data === true);
      // }
    } catch (error) {
      console.error('Error checking guest status:', error);
      // Allow upload if check fails (for development)
      setCanUpload(true);
    } finally {
      setIsCheckingGuest(false);
    }
  };


  const uploadToSupabase = async (uri: string, fileName: string, mimeType: string) => {
    try {
      console.log('📤 Starting upload process...');
      console.log('File info:', { fileName, mimeType, uri: uri.substring(0, 50) + '...' });
      
      // Diagnostic check
      console.log('🔍 Running diagnostics...');
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      console.log('Supabase URL configured:', !!supabaseUrl, supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING');
      console.log('Supabase Key configured:', !!supabaseKey, supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          'Supabase not configured!\n\n' +
          'Please create a .env file with:\n' +
          'EXPO_PUBLIC_SUPABASE_URL=your_url\n' +
          'EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key\n\n' +
          'Then restart the app with: npm start'
        );
      }
      
      const supabase = ensureSupabaseConfigured();
      console.log('✅ Supabase client configured');
      
      // Test connection
      console.log('🔌 Testing Supabase connection...');
      try {
        const { error: testError } = await supabase.from('upload').select('id').limit(1);
        if (testError && !testError.message.includes('relation') && !testError.message.includes('does not exist')) {
          console.warn('⚠️ Connection test warning:', testError.message);
        } else {
          console.log('✅ Supabase connection OK');
        }
      } catch (testErr) {
        console.warn('⚠️ Connection test failed (may be OK if tables not created):', testErr);
      }
      
      const token = await getOrCreateGuestToken();
      setGuestToken(token);
      console.log('✅ Guest token:', token.substring(0, 20) + '...');

      // Read file as ArrayBuffer (Expo Go safe - works on iOS + Android)
      setUploadStage('Reading file…');
      setUploadProgress(0);

      console.log('📖 Reading file from URI...');
      let arrayBuffer: ArrayBuffer;

      try {
        arrayBuffer = await readFileAsArrayBuffer(uri);
        
        // FIX: Validate ArrayBuffer is valid
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error('File read succeeded but ArrayBuffer is empty');
        }
        
        // FIX: Check for reasonable file size (prevent memory issues)
        // Mobile upload limit is stricter (12MB) to prevent memory spikes on Expo Go iOS
        const maxMobileSize = 12 * 1024 * 1024; // 12MB for mobile
        const maxSize = 50 * 1024 * 1024; // 50MB absolute limit
        if (arrayBuffer.byteLength > maxMobileSize) {
          throw new Error(`File too large for mobile upload. Please use a smaller statement (<= 12MB).`);
        }
        if (arrayBuffer.byteLength > maxSize) {
          throw new Error(`File is too large (${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB). Maximum size is 50MB.`);
        }
        
        console.log('✅ File read successfully, bytes:', arrayBuffer.byteLength);
        setUploadProgress(10);
      } catch (fileError) {
        // Error messages are already user-friendly from readFileAsArrayBuffer
        // Just re-throw with context
        const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
        throw new Error(`Failed to read file: ${errorMsg}`);
      }

      setUploadStage('Preparing upload…');
      setUploadProgress(15);

      // Create unique file path
      const fileExt = fileName.split('.').pop() || 'pdf';
      const filePath = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Upload to Supabase Storage with retry
      setUploadStage('Uploading to storage…');
      setUploadProgress(25);

      console.log('📦 Uploading to storage bucket "uploads"...');
      
      // Retry helper for storage upload
      const retryOnce = async <T,>(fn: () => Promise<T>): Promise<T> => {
        try {
          return await fn();
        } catch (e) {
          console.warn('⚠️ Storage upload failed, retrying once...');
          return await fn();
        }
      };
      
      const { data: uploadData, error: storageError } = await retryOnce(() =>
        supabase.storage
          .from('uploads')
          .upload(filePath, arrayBuffer, {
            contentType: mimeType,
            upsert: false,
          })
      );

      if (storageError) {
        console.error('❌ Storage error (raw):', storageError);
        // Show actual error message to help debug
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }
      // Use the ACTUAL path returned by Supabase Storage (not the constructed one)
      const actualFilePath = uploadData?.path || filePath;
      console.log('✅ File uploaded to storage:', actualFilePath);
      console.log('📝 Constructed path was:', filePath);
      console.log('📝 Actual path from Storage:', actualFilePath);

      setUploadProgress(55);
      setUploadStage('Saving upload record…');

      // Get file size
      const fileSize = arrayBuffer.byteLength;

      // Create upload record
      console.log('💾 Creating upload record in database...');
      const { data: uploadRecord, error: dbError } = await supabase
        .from('upload')
        .insert({
          guest_token: token,
          file_name: fileName,
          file_path: actualFilePath, // Use the actual path from Storage
          file_size: fileSize,
          mime_type: mimeType,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError || !uploadRecord) {
        let errorMsg = 'Failed to save upload record.';
        
        // Provide user-friendly error messages
        if (dbError?.message?.includes('relation') || dbError?.message?.includes('does not exist') || dbError?.code === 'PGRST116') {
          errorMsg = 'Database not configured. Please contact support.';
        } else if (dbError?.message?.includes('permission') || dbError?.message?.includes('RLS')) {
          errorMsg = 'Permission denied. Please contact support.';
        } else if (dbError?.message?.includes('network') || dbError?.message?.includes('timeout')) {
          errorMsg = 'Network error. Please check your connection and try again.';
        } else {
          errorMsg = `Database error: ${dbError?.message || 'Unknown error'}`;
        }
        
        throw new Error(errorMsg);
      }
      console.log('✅ Upload record created:', uploadRecord.id);

      // Invoke edge function to enqueue job (fire and forget - don't await)
      // Processing screen will poll for progress
      console.log('🚀 Enqueuing processing job (async)...');
      supabase.functions.invoke('parse-statement', {
        body: {
          upload_id: uploadRecord.id,
          guest_token: token,
        },
      }).then(async (result) => {
        // After enqueue, trigger worker to process immediately
        if (result.data?.job_id) {
          console.log(`✅ Job enqueued: ${result.data.job_id}, triggering worker...`);
          // Trigger worker (non-blocking)
          supabase.functions.invoke('process-job', {
            body: { job_id: result.data.job_id },
          }).catch((err) => {
            console.warn('Worker trigger failed (will retry via polling):', err);
          });
        }
      }).catch((err) => {
        // Log but don't block - processing screen will show errors
        const errorMsg = (err as any)?.message || String(err);
        if (errorMsg.includes('502') || errorMsg.includes('Bad Gateway')) {
          console.warn('⚠️ Processing service temporarily unavailable (502). Will retry automatically.');
        } else {
          console.error('Edge function invoke error (non-blocking):', err);
        }
      });

      // Navigate immediately (don't block on parsing)
      return { uploadId: uploadRecord.id, fileName, filePath };
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Upload failed:', error.message);
      } else {
        console.error('❌ Upload failed:', error);
      }
      throw error;
    }
  };

  const handleMultipleImageUpload = async (assets: ImagePicker.ImagePickerAsset[]) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStage(`Uploading ${assets.length} pages…`);
      console.log(`📤 Starting batch upload of ${assets.length} images...`);

      const supabase = ensureSupabaseConfigured();
      const token = await getOrCreateGuestToken();
      setGuestToken(token);

      // Create one upload record to represent the batch
      const batchFileName = `statement_${Date.now()}_${assets.length}_pages`;
      
      // Upload all images to storage and collect file paths
      const filePaths: string[] = [];
      const fileSizes: number[] = [];
      
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        console.log(`📦 Uploading image ${i + 1}/${assets.length}...`);

        // Read image as ArrayBuffer (Expo Go safe)
        let imageArrayBuffer: ArrayBuffer;
        try {
          imageArrayBuffer = await readFileAsArrayBuffer(asset.uri);
          
          // Validate ArrayBuffer is valid
          if (!imageArrayBuffer || imageArrayBuffer.byteLength === 0) {
            throw new Error('Image file appears to be empty');
          }
          
          // Check for reasonable file size (prevent memory issues)
          const maxSize = 10 * 1024 * 1024; // 10MB per image limit
          if (imageArrayBuffer.byteLength > maxSize) {
            throw new Error(`Image ${i + 1} is too large (${Math.round(imageArrayBuffer.byteLength / 1024 / 1024)}MB). Maximum size is 10MB per image.`);
          }
        } catch (readError) {
          // Error messages are already user-friendly from readFileAsArrayBuffer
          const errorMsg = readError instanceof Error ? readError.message : 'Unknown error';
          throw new Error(`Failed to read image ${i + 1}: ${errorMsg}`);
        }

        // Create unique file path for this image
        const filePath = `${Date.now()}_${i}_${asset.fileName || `image_${i}.jpg`}`.replace(/[^a-zA-Z0-9.-]/g, '_');

        // Upload to Supabase Storage with retry
        const retryOnce = async <T,>(fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn();
          } catch (e) {
            console.warn(`⚠️ Storage upload failed for image ${i + 1}, retrying once...`);
            return await fn();
          }
        };
        
        const { data: uploadData, error: storageError } = await retryOnce(() =>
          supabase.storage
            .from('uploads')
            .upload(filePath, imageArrayBuffer, {
              contentType: 'image/jpeg',
              upsert: false,
            })
        );

        if (storageError) {
          console.error(`❌ Storage error for image ${i + 1} (raw):`, storageError);
          throw new Error(`Storage upload failed for image ${i + 1}: ${storageError.message}`);
        }

        // Use the ACTUAL path returned by Supabase Storage
        const actualFilePath = uploadData?.path || filePath;
        if (!actualFilePath) {
          throw new Error(`Upload succeeded but no file path returned for image ${i + 1}`);
        }
        
        filePaths.push(actualFilePath);
        fileSizes.push(imageArrayBuffer.byteLength);
        console.log(`✅ Image ${i + 1} uploaded: ${actualFilePath} (${imageArrayBuffer.byteLength} bytes)`);
        setUploadProgress(Math.round(((i + 1) / assets.length) * 50)); // first half is uploading images
      }

      // Create upload record with all file paths stored as JSON
      const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);
      const { data: uploadRecord, error: dbError } = await supabase
        .from('upload')
        .insert({
          guest_token: token,
          file_name: batchFileName,
          file_path: JSON.stringify(filePaths), // Store all paths as JSON
          file_size: totalSize,
          mime_type: 'image/jpeg',
          status: 'pending',
        })
        .select()
        .single();

      if (dbError || !uploadRecord) {
        const errorMsg = dbError?.message?.includes('network') || dbError?.message?.includes('timeout')
          ? 'Network error saving upload. Please check your connection and try again.'
          : dbError?.message?.includes('relation') || dbError?.message?.includes('does not exist')
          ? 'Database not configured. Please contact support.'
          : `Failed to save upload: ${dbError?.message || 'Unknown error'}`;
        throw new Error(errorMsg);
      }

      console.log(`✅ Batch upload record created: ${uploadRecord.id} with ${assets.length} images`);

      setUploadProgress(65);
      setUploadStage('Starting analysis…');

      // Invoke edge function to enqueue job (fire and forget - don't await)
      // Processing screen will poll for progress
      console.log('🚀 Enqueuing processing job for batch (async)...');
      supabase.functions.invoke('parse-statement', {
        body: {
          upload_id: uploadRecord.id,
          guest_token: token,
        },
      }).then(async (result) => {
        // After enqueue, trigger worker to process immediately
        if (result.data?.job_id) {
          console.log(`✅ Job enqueued: ${result.data.job_id}, triggering worker...`);
          // Trigger worker (non-blocking)
          supabase.functions.invoke('process-job', {
            body: { job_id: result.data.job_id },
          }).catch((err) => {
            console.warn('Worker trigger failed (will retry via polling):', err);
          });
        }
      }).catch((err) => {
        // Log but don't block - processing screen will show errors
        const errorMsg = (err as any)?.message || String(err);
        if (errorMsg.includes('502') || errorMsg.includes('Bad Gateway')) {
          console.warn('⚠️ Processing service temporarily unavailable (502). Will retry automatically.');
        } else {
          console.error('Edge function invoke error (non-blocking):', err);
        }
      });

      // Navigate to processing screen
      router.push({
        pathname: '/processing',
        params: {
          uploadId: uploadRecord.id,
          fileName: batchFileName,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload images. Please try again.';
      console.error('❌ Batch upload failed:', errorMessage);
      Alert.alert('Upload Failed', errorMessage, [{ text: 'OK', style: 'default' }]);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const handleFileUpload = async (uri: string, fileName: string, mimeType: string) => {
    try {
      setIsUploading(true);

      const fileInfo = await uploadToSupabase(uri, fileName, mimeType);

      // Navigate to processing screen with upload ID
      router.push({
        pathname: '/processing',
        params: {
          uploadId: fileInfo.uploadId,
          fileName: fileInfo.fileName,
        },
      });
    } catch (error) {
      // Single, concise error log
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('❌ Upload failed:', errorMessage);
      
      // Show user-friendly error alert
      Alert.alert(
        'Upload Failed',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const pickDocument = async () => {
    // TEMPORARILY DISABLED FOR TESTING - Allow unlimited uploads
    // if (!canUpload) {
    //   Alert.alert(
    //     'Upload Limit Reached',
    //     'You have used your free upload. Create an account to upload more statements.',
    //     [
    //       { text: 'OK', style: 'default' },
    //       {
    //         text: 'Create Account',
    //         style: 'default',
    //         onPress: () => router.push('/paywall'),
    //       },
    //     ]
    //   );
    //   return;
    // }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await handleFileUpload(asset.uri, asset.name, asset.mimeType || 'application/pdf');
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const pickImage = async () => {
    // TEMPORARILY DISABLED FOR TESTING - Allow unlimited uploads
    // if (!canUpload) {
    //   Alert.alert(
    //     'Upload Limit Reached',
    //     'You have used your free upload. Create an account to upload more statements.',
    //     [
    //       { text: 'OK', style: 'default' },
    //       {
    //         text: 'Create Account',
    //         style: 'default',
    //         onPress: () => router.push('/paywall'),
    //       },
    //     ]
    //   );
    //   return;
    // }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 20,
        quality: 0.6, // Compress images for faster upload (was 0.9)
      });

      const assets = result.assets ?? [];
      if (result.canceled || assets.length === 0) return;

      // Handle multiple images
      await handleMultipleImageUpload(assets);
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  if (isCheckingGuest) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Checking...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // TEMPORARILY DISABLED FOR TESTING - Allow unlimited uploads
  // if (!canUpload) {
  //   return (
  //     <ThemedView style={styles.container}>
  //       <View style={styles.content}>
  //         <ThemedText type="title" style={styles.title}>
  //           Upload Limit Reached
  //         </ThemedText>
  //         <ThemedText style={styles.subtitle}>
  //           You have used your free upload. Create an account to upload more statements and track your finances over time.
  //         </ThemedText>
  //         <Pressable
  //           style={styles.createAccountButton}
  //           onPress={() => router.push('/paywall')}
  //         >
  //           <ThemedText style={styles.buttonText}>Create Account</ThemedText>
  //         </Pressable>
  //       </View>
  //     </ThemedView>
  //   );
  // }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Upload Statement
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Select a PDF or image of your bank statement
        </ThemedText>

        {isUploading && (
          <View style={{ width: '100%', maxWidth: 320, marginBottom: 24 }}>
            <ThemedText style={{ opacity: 0.8, marginBottom: 8 }}>
              {uploadStage || 'Working…'}
            </ThemedText>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: '#222', overflow: 'hidden' }}>
              <View style={{ width: `${uploadProgress}%`, height: 8, backgroundColor: '#007AFF' }} />
            </View>
            <ThemedText style={{ opacity: 0.6, marginTop: 8 }}>
              {uploadProgress}% 
            </ThemedText>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={pickDocument}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Upload PDF</ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={pickImage}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Upload Image</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 48,
    textAlign: 'center',
    opacity: 0.7,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    maxWidth: 320,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  createAccountButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
