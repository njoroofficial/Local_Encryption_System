# SecureVault Desktop Application

This project has been integrated with Electron to provide a desktop application experience for the SecureVault application.

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

### Installation

1. Install dependencies for both frontend and backend:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Running the Application in Development Mode

```bash
# Run the Electron app in development mode
npm run electron:dev
```

This command will:
1. Start the React development server
2. Start the backend server
3. Launch the Electron app that connects to these services

## Building for Production

To build the desktop application for production:

```bash
# Build the Electron app for your platform
npm run electron:build
```

This will create distributable packages in the `dist` directory.

## Project Structure

- `electron.js` - Main Electron process file
- `preload.js` - Preload script for secure renderer process communication
- `src/utils/electronBridge.js` - Utility to facilitate communication with Electron from React
- `src/components/ElectronInfo.jsx` - Component to display Electron runtime information

## Electron Features

The desktop application provides the following additional features:

1. **Native Application Experience** - Runs as a standalone desktop application
2. **Offline Capability** - Can work offline with local data storage
3. **System Integration** - Better integration with the operating system
4. **Enhanced Security** - Local encryption without transmitting data over networks
5. **Custom Window Management** - Window size, position and state management

## Customizing the App

### Icons

For production use, replace the placeholder icons with proper application icons:

- `assets/icon.ico` - Windows icon
- `assets/icon.png` - Linux icon
- `assets/icon.icns` - MacOS icon (currently not provided)

### Configuration

Edit the `electron-builder.env` file to customize the build environment.

## Troubleshooting

### Common Issues

- **Backend Connection Issues** - Ensure backend server is running on port 5000
- **Build Failures** - Make sure all dependencies are properly installed
- **Windows Path Issues** - Use correct path separators in configuration files 