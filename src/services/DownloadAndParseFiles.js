import axios from "axios";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { v4 as uuidv4 }  from "uuid";

const downloadAndParseFile = async (url, type) => {
  const tempFileName = `download_${uuidv4()}.${type}`;

  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(tempFileName);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    let dataBuffer = fs.readFileSync(tempFileName);

    let fileText;
    if (type === "pdf") {
      const pdfData = await pdf(dataBuffer);
      fileText = pdfData.text;
    } else {
      fileText = dataBuffer.toString();
    }

    fs.unlinkSync(tempFileName);

    return fileText;
  } catch (error) {
    console.error("Error reading file from URL:", error);
    if (fs.existsSync(tempFileName)) {
      fs.unlinkSync(tempFileName);
    }
    throw error;
  }
};

export default downloadAndParseFile;
