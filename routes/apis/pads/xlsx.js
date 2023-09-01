const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
const fetch = require('node-fetch');
const { DB } = include('config/')

exports.main = async (req, res, output = 'csv') => {
  try {
    const downloadDir = 'downloaded_files'; // Create a directory for downloaded files
    await fs.promises.mkdir(downloadDir, { recursive: true });
	const urls = DB.conns.map(p=> ({
		url: p.baseurl + `/apis/fetch/pads?output=${output}&render=true`,
		...p
	}))

    for (let i = 1; i <= urls.length; i++) {
      const zipFileName = `${urls[i].key}_${i}.zip`;
      await downloadZipFile(
        urls[i].url,
        path.join(downloadDir, zipFileName) 
      );
    }

    await zipAndSendFolder(res, downloadDir); // Zip the downloaded folder and send to the client
  } catch (error) {
    console.error(`Error handling request: ${error.message}`);
    return res.redirect('/module-error');
  }
};

// Function to download a ZIP file from the API
async function downloadZipFile(url, filePath, maxRetries = 3) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download ${filePath}. Status: ${response.status}`);
      }

      const buffer = await response.buffer();
      await fs.promises.writeFile(filePath, buffer);
      return; // Exit the function on successful download
    } catch (error) {
      console.error(`Error downloading ${filePath}: ${error.message}`);
      retries++;

      if (retries < maxRetries) {
        console.log(`Retrying download (${retries}/${maxRetries})...`);
        // Add a delay before retrying to avoid overloading the server
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds delay
      } else {
        console.error(`Max retries reached. Unable to download ${filePath}`);
        throw error; // Throw the error after max retries
      }
    }
  }
}

// Function to zip the downloaded folder and send to the client
async function zipAndSendFolder(res, sourceDir) {
  try {
    const zip = new JSZip();
    const files = await fs.promises.readdir(sourceDir);

    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      const data = await fs.promises.readFile(filePath);
      zip.file(file, data);
    }

    const zippedFolder = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=downloaded_files.zip');
    res.send(zippedFolder);
	await fs.promises.rmdir(sourceDir, { recursive: true });
  } catch (error) {
    console.error(`Error zipping and sending folder: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
}
