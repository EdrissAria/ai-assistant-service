import { Pinecone } from "@pinecone-database/pinecone";
import { config } from "dotenv";
config();

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

class PineconeService {
  indexName;
  namespace;

  constructor(indexName, namespace) {
    this.indexName = indexName;
    this.namespace = namespace;
  }

  async createIndex() {
    try {
      const indexes = await pc.listIndexes();
      const indexExists = indexes.indexes.some(
        (index) => index.name === this.indexName
      );

      if (!indexExists) {
        await pc.createIndexForModel({
          name: this.indexName,
          cloud: "aws",
          region: "us-east-1",
          embed: {
            model: "multilingual-e5-large",
            fieldMap: {
              text: "description",
            },
          },
          waitUntilReady: true,
        });
      }

      return pc.index(this.indexName).namespace(this.namespace);
    } catch (error) {
      console.error("Error creating index:", error);
      throw error;
    }
  }

  async insertdata(data) {
    try {
      const index = await this.createIndex();
      
      await index.upsertRecords(data);

      console.log("Data successfully imported to Pinecone.");
    } catch (error) {
      console.error("Error importing data:", error);
    }
  }

  async getVectordata(query) {
    const index = await this.createIndex();

    const results = await index.searchRecords({
      query: {
        topK: 3,
        inputs: { text: query },
      },
    });

    console.log("result: ", results.result.hits);
  }

  async updateVectordata(data) {
    try {
      
      const index = await this.createIndex();

      const existingRecord = await index.fetch(data.id);

      if (Object.keys(existingRecord.records).length == 0) {
        await index.deleteOne(data.id);
      }
      
      await index.upsertRecords([data]);

      console.log("Data successfully updated");
    } catch (error) {
      console.error("Error updating data:", error);
    }
  }

  async deleteVectordata(id) {
    try {
      const index = await this.createIndex();
      await index.deleteOne(id);
      console.log(`Vector with ID ${id} successfully deleted.`);
    } catch (error) {
      console.error("Error deleting vector data:", error);
      throw error;
    }
  }
}

export default PineconeService;
