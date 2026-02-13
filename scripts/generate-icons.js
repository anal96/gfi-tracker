const fs = require('fs');
const path = require('path');

// Simple function to create a basic icon using canvas (requires canvas package)
// For now, we'll create a simple HTML file that can generate icons

const iconHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Generate PWA Icons</title>
</head>
<body>
    <h1>PWA Icon Generator</h1>
    <p>Open this file in a browser and click "Generate Icons"</p>
    <canvas id="icon192" width="192" height="192" style="border: 1px solid #000;"></canvas>
    <canvas id="icon512" width="512" height="512" style="border: 1px solid #000;"></canvas>
    <br><br>
    <button onclick="generateIcons()">Generate & Download Icons</button>

    <script>
        function generateIcons() {
            // Generate 192x192 icon
            const canvas192 = document.getElementById('icon192');
            const ctx192 = canvas192.getContext('2d');
            
            // Blue gradient background
            const grad192 = ctx192.createLinearGradient(0, 0, 192, 192);
            grad192.addColorStop(0, '#2563eb');
            grad192.addColorStop(1, '#1e40af');
            ctx192.fillStyle = grad192;
            ctx192.fillRect(0, 0, 192, 192);
            
            // White text "GFI"
            ctx192.fillStyle = 'white';
            ctx192.font = 'bold 60px Arial';
            ctx192.textAlign = 'center';
            ctx192.textBaseline = 'middle';
            ctx192.fillText('GFI', 96, 96);
            
            // Generate 512x512 icon
            const canvas512 = document.getElementById('icon512');
            const ctx512 = canvas512.getContext('2d');
            
            const grad512 = ctx512.createLinearGradient(0, 0, 512, 512);
            grad512.addColorStop(0, '#2563eb');
            grad512.addColorStop(1, '#1e40af');
            ctx512.fillStyle = grad512;
            ctx512.fillRect(0, 0, 512, 512);
            
            ctx512.fillStyle = 'white';
            ctx512.font = 'bold 160px Arial';
            ctx512.textAlign = 'center';
            ctx512.textBaseline = 'middle';
            ctx512.fillText('GFI', 256, 256);
            
            // Download icons
            canvas192.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'icon-192.png';
                a.click();
                URL.revokeObjectURL(url);
            });
            
            setTimeout(() => {
                canvas512.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'icon-512.png';
                    a.click();
                    URL.revokeObjectURL(url);
                    alert('Icons downloaded! Place them in the public folder.');
                });
            }, 500);
        }
        
        // Auto-generate on load for preview
        window.onload = generateIcons;
    </script>
</body>
</html>`;

// Create the HTML file
const publicDir = path.join(__dirname, '..', 'public');
const iconGeneratorPath = path.join(publicDir, 'generate-icons.html');

fs.writeFileSync(iconGeneratorPath, iconHTML);
console.log('✅ Icon generator created at:', iconGeneratorPath);
console.log('📝 Open this file in your browser to generate icons');
console.log('💡 After generating, move icon-192.png and icon-512.png to the public folder');