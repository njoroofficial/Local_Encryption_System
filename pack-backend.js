const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const backendDir = path.join(__dirname, 'backend');
const backendPackageJsonPath = path.join(backendDir, 'package.json');
const backendNodeModulesPath = path.join(backendDir, 'node_modules');
const backendDistDir = path.join(__dirname, 'dist', 'backend');

// Make sure the dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
}

// Make sure the backend dist directory exists
if (!fs.existsSync(backendDistDir)) {
  fs.mkdirSync(backendDistDir, { recursive: true });
}

// Function to copy recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), 
                        path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy backend files to dist folder
console.log('Copying backend files to dist folder...');
try {
  // Copy all files except node_modules
  fs.readdirSync(backendDir).forEach(file => {
    if (file !== 'node_modules') {
      const srcPath = path.join(backendDir, file);
      const destPath = path.join(backendDistDir, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        copyRecursiveSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });
  
  console.log('Backend files copied successfully.');
  
  // Install production dependencies in the backend dist folder
  console.log('Installing backend production dependencies...');
  execSync('npm install --only=production', { 
    cwd: backendDistDir, 
    stdio: 'inherit' 
  });
  
  console.log('Backend is ready for packaging.');
} catch (error) {
  console.error('Error preparing backend:', error);
} 