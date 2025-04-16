# LOCAL ENCRYPTION AND STORAGE MANAGEMENT SYSTEM

## SYSTEM DESCRIPTION

The Local Encryption and Storage Management System is a secure vault application that allows users to encrypt, store, and manage sensitive files locally on their computer. The system provides a secure environment for storing confidential data with strong encryption methods.

## INSTALLATION INSTRUCTIONS

### System Requirements
- Windows operating system
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation Steps

1. **Clone or download the application**
   - Download the installer package for your operating system from the provided source

2. **Installation using installer**
   - Run the installer and follow the on-screen instructions
   - The application will be installed on your system automatically

3. **Manual installation (for developers)**
   - Extract the source code to a directory
   - Open a terminal/command prompt and navigate to the extracted directory
   - Install dependencies:
     ```
     npm install
     cd backend
     npm install
     cd ..
     ```
   - Create a `.env` file in both root and backend directories (see `.env.example` for required variables)
   - Start the development server:
     ```
     npm run electron:dev
     ```

4. **First-time setup**
   - Register a new account through the Sign Up interface
   - Verify your email address through the verification link
   - Login to your account
   - Create a vault with a strong password to begin storing and encrypting files

## USAGE

1. Start the application from your desktop or applications folder
2. Login with your credentials
3. Create or access existing vaults
4. Upload files to your vaults to automatically encrypt them
5. Download and decrypt files when needed using your vault password
6. Manage your vaults and files through the intuitive user interface
7. View activity logs and security reports to monitor system usage

## SECURITY FEATURES

- AES-256-CBC encryption standard for all files
- Secure vault creation with password protection
- User authentication and authorization
- Activity logging for security monitoring
- End-to-end encryption for all stored data

## SUPPORT

For any issues or questions, please contact:
- Moses Njoroge Wairimu
- Email: mosesn579@gmail.com 