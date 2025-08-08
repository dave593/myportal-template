const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
    constructor() {
        this.drive = null;
        this.isConfigured = false;
    }

    async configure() {
        try {
            // Check if we have the necessary environment variables
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.log('Google Drive: No credentials configured');
                return false;
            }

            let credentials;
            
            // Try to load credentials from environment variable first
            if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                try {
                    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                } catch (error) {
                    console.error('Google Drive: Invalid service account key in environment variable');
                    return false;
                }
            } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                // Load from file
                try {
                    const keyPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
                    const keyFile = fs.readFileSync(keyPath, 'utf8');
                    credentials = JSON.parse(keyFile);
                } catch (error) {
                    console.error('Google Drive: Could not load credentials file:', error.message);
                    return false;
                }
            }

            // Create auth client
            const auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/drive.file'
                ]
            });

            // Create drive instance
            this.drive = google.drive({ version: 'v3', auth });
            this.isConfigured = true;
            
            console.log('Google Drive: Service configured successfully');
            return true;
        } catch (error) {
            console.error('Google Drive: Configuration failed:', error.message);
            return false;
        }
    }

    async createClientFolder(clientName, propertyAddress, customerType = 'Residential') {
        if (!this.isConfigured || !this.drive) {
            console.log('Google Drive: Service not configured, skipping folder creation');
            return null;
        }

        try {
            // Sanitize folder name (remove special characters that might cause issues)
            const sanitizedName = clientName.replace(/[<>:"/\\|?*]/g, '_').trim();
            const sanitizedAddress = propertyAddress.replace(/[<>:"/\\|?*]/g, '_').trim();
            
            const folderName = `${sanitizedName} - ${sanitizedAddress}`;
            
            // Determine root folder ID based on customer type
            let rootFolderId;
            if (customerType === 'Commercial') {
                rootFolderId = '12bR_COjrwE1DySRc4QfrUFEKGvzsIBpq';
                console.log('Google Drive: Using Commercial folder');
            } else {
                rootFolderId = '1FnfkUI0vHCpKkZA9fdEpKxiDcg97URli';
                console.log('Google Drive: Using Residential folder');
            }
            
            console.log(`Google Drive: Creating folder: ${folderName}`);
            console.log(`Google Drive: Target location: ${customerType} Drive (ID: ${rootFolderId})`);

            // Create folder metadata
            const folderMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [rootFolderId]
            };

            // Create the folder
            const folder = await this.drive.files.create({
                resource: folderMetadata,
                fields: 'id, name, webViewLink, parents',
                supportsAllDrives: true, // Enable Shared Drive support
                supportsTeamDrives: true // Legacy support for older Shared Drives
            });

            console.log(`Google Drive: Folder created successfully - ID: ${folder.data.id}, Name: ${folder.data.name}`);
            console.log(`Google Drive: Folder location: ${customerType} Drive`);
            
            return {
                id: folder.data.id,
                name: folder.data.name,
                webViewLink: folder.data.webViewLink,
                customerType: customerType,
                parentId: rootFolderId
            };
        } catch (error) {
            console.error('Google Drive: Error creating folder:', error.message);
            
            // Provide more specific error information
            if (error.message.includes('403')) {
                console.error('Google Drive: Permission denied. Check if the Service Account has access to the Shared Drive.');
            } else if (error.message.includes('404')) {
                console.error('Google Drive: Shared Drive not found. Verify the folder ID.');
            }
            
            return null;
        }
    }

    async uploadFileToClientFolder(folderId, fileName, fileContent, mimeType = 'text/plain') {
        if (!this.isConfigured || !this.drive) {
            console.log('Google Drive: Service not configured, skipping file upload');
            return null;
        }

        try {
            console.log(`Google Drive: Uploading file ${fileName} to folder ${folderId}`);

            const fileMetadata = {
                name: fileName,
                parents: [folderId]
            };

            // Create a readable stream from the buffer
            const { Readable } = require('stream');
            const stream = new Readable();
            stream.push(fileContent);
            stream.push(null); // End the stream

            const media = {
                mimeType: mimeType,
                body: stream
            };

            const file = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink'
            });

            console.log(`Google Drive: File uploaded successfully - ID: ${file.data.id}, Name: ${file.data.name}`);
            
            return {
                id: file.data.id,
                name: file.data.name,
                webViewLink: file.data.webViewLink
            };
        } catch (error) {
            console.error('Google Drive: Error uploading file:', error.message);
            return null;
        }
    }

    async uploadPDFReportToClientFolder(clientName, clientEmail, pdfBuffer, reportType = 'Fire Escape Inspection') {
        if (!this.isConfigured || !this.drive) {
            console.log('Google Drive: Service not configured, skipping PDF upload');
            return null;
        }

        try {
            console.log(`Google Drive: Uploading PDF report for client: ${clientName}`);
            
            // Find client folder by name (try multiple search strategies)
            let clientFolders = await this.findClientFolder(clientName, clientEmail);
            
            // If no folders found, try searching with just the first name
            if (!clientFolders || clientFolders.length === 0) {
                const firstName = clientName.split(' ')[0];
                console.log(`Google Drive: Trying search with first name: ${firstName}`);
                clientFolders = await this.findClientFolder(firstName, clientEmail);
            }
            
            // If still no folders found, try searching with last name
            if (!clientFolders || clientFolders.length === 0) {
                const nameParts = clientName.split(' ');
                if (nameParts.length > 1) {
                    const lastName = nameParts[nameParts.length - 1];
                    console.log(`Google Drive: Trying search with last name: ${lastName}`);
                    clientFolders = await this.findClientFolder(lastName, clientEmail);
                }
            }
            
            if (!clientFolders || clientFolders.length === 0) {
                console.log(`Google Drive: No folder found for client ${clientName}, creating new folder`);
                
                // Create folder in Residential drive by default
                const folderResult = await this.createClientFolder(clientName, 'Address not specified', 'Residential');
                if (!folderResult) {
                    throw new Error('Failed to create client folder for PDF upload');
                }
                
                return await this.uploadFileToClientFolder(
                    folderResult.id,
                    `${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`,
                    pdfBuffer,
                    'application/pdf'
                );
            }

            // Use the first found folder
            const clientFolder = clientFolders[0];
            console.log(`Google Drive: Found client folder: ${clientFolder.name} (ID: ${clientFolder.id})`);

            const fileName = `${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
            
            return await this.uploadFileToClientFolder(
                clientFolder.id,
                fileName,
                pdfBuffer,
                'application/pdf'
            );
        } catch (error) {
            console.error('Google Drive: Error uploading PDF report:', error.message);
            return null;
        }
    }

    async findClientFolder(clientName, clientEmail) {
        if (!this.isConfigured || !this.drive) {
            console.log('Google Drive: Service not configured, skipping folder search');
            return [];
        }

        try {
            console.log(`Google Drive: Searching for client folder: ${clientName}`);

            // Search in both Commercial and Residential folders
            const searchFolders = [
                '12bR_COjrwE1DySRc4QfrUFEKGvzsIBpq', // Commercial
                '1FnfkUI0vHCpKkZA9fdEpKxiDcg97URli'  // Residential
            ];

            let allFolders = [];

            for (const parentId of searchFolders) {
                try {
                    // Try multiple search strategies
                    const searchQueries = [
                        `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '${clientName}'`,
                        `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '${clientName.replace(/[^a-zA-Z0-9]/g, ' ')}'`,
                        `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '${clientName.toLowerCase()}'`,
                        `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '${clientName.toUpperCase()}'`
                    ];

                    for (const query of searchQueries) {
                        try {
                            const response = await this.drive.files.list({
                                q: query,
                                fields: 'files(id, name, webViewLink, parents)',
                                supportsAllDrives: true,
                                includeItemsFromAllDrives: true
                            });

                            if (response.data.files && response.data.files.length > 0) {
                                allFolders = allFolders.concat(response.data.files);
                                console.log(`Google Drive: Found ${response.data.files.length} folders with query: ${query}`);
                                break; // Found folders with this query, no need to try others
                            }
                        } catch (queryError) {
                            console.warn(`Google Drive: Error with search query: ${queryError.message}`);
                        }
                    }
                } catch (error) {
                    console.warn(`Google Drive: Error searching in folder ${parentId}:`, error.message);
                }
            }

            // Remove duplicates based on folder ID
            const uniqueFolders = allFolders.filter((folder, index, self) => 
                index === self.findIndex(f => f.id === folder.id)
            );

            console.log(`Google Drive: Found ${uniqueFolders.length} unique client folders`);
            return uniqueFolders;
        } catch (error) {
            console.error('Google Drive: Error finding client folder:', error.message);
            return [];
        }
    }

    async listClientFolders() {
        if (!this.isConfigured || !this.drive) {
            console.log('Google Drive: Service not configured, cannot list folders');
            return [];
        }

        try {
            const response = await this.drive.files.list({
                q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields: 'files(id, name, createdTime, webViewLink)',
                orderBy: 'createdTime desc'
            });

            return response.data.files || [];
        } catch (error) {
            console.error('Google Drive: Error listing folders:', error.message);
            return [];
        }
    }

    async testConnection() {
        if (!this.isConfigured || !this.drive) {
            return { success: false, message: 'Service not configured' };
        }

        try {
            const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 'root';
            const isSharedDrive = rootFolderId !== 'root';
            
            console.log(`Google Drive: Testing connection to ${isSharedDrive ? 'Shared Drive' : 'Root Drive'} (ID: ${rootFolderId})`);
            
            // Try to list files to test connection
            const response = await this.drive.files.list({
                pageSize: 1,
                fields: 'files(id, name)',
                q: isSharedDrive ? `'${rootFolderId}' in parents` : undefined,
                supportsAllDrives: true,
                supportsTeamDrives: true,
                includeItemsFromAllDrives: isSharedDrive
            });

            // Test if we can access the specific folder
            if (isSharedDrive) {
                try {
                    await this.drive.files.get({
                        fileId: rootFolderId,
                        fields: 'id, name, mimeType',
                        supportsAllDrives: true,
                        supportsTeamDrives: true
                    });
                    console.log('Google Drive: Successfully accessed Shared Drive');
                } catch (folderError) {
                    return { 
                        success: false, 
                        message: `Cannot access Shared Drive (ID: ${rootFolderId}). Error: ${folderError.message}` 
                    };
                }
            }

            return { 
                success: true, 
                message: `Connection successful to ${isSharedDrive ? 'Shared Drive' : 'Root Drive'}`,
                fileCount: response.data.files ? response.data.files.length : 0,
                location: isSharedDrive ? 'Shared Drive' : 'Root Drive',
                rootFolderId: rootFolderId
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Connection failed: ${error.message}` 
            };
        }
    }
}

module.exports = GoogleDriveService; 