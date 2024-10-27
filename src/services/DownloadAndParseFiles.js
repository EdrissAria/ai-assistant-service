import axios from 'axios';
import fs from 'fs';
import pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const downloadAndParseFile = async (url, type) => {
    const tempFileName = path.join('test', 'data', `download_${uuidv4()}.${type}`);

    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        if (response.status !== 200) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const dir = path.dirname(tempFileName);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        const writer = fs.createWriteStream(tempFileName);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        let dataBuffer = fs.readFileSync(tempFileName);
        let fileText;

        if (type === 'pdf') {
            const pdfData = await pdf(dataBuffer);
            fileText = pdfData.text;
        } else {
            fileText = dataBuffer.toString();
        }

        fs.unlinkSync(tempFileName);
        return fileText;
    } catch (error) {
        console.error('Error in downloadAndParseFile:', error.message);
        if (fs.existsSync(tempFileName)) {
            fs.unlinkSync(tempFileName);
        }
        throw error;
    }
};

export default downloadAndParseFile;
