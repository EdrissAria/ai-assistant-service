import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { PineconeStore } from "@langchain/pinecone";
import PineconeService from "./PineconeService.js";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs";
import { Pinecone } from "@pinecone-database/pinecone";
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

import { config } from "dotenv";
config();

class Ai {
  constructor() {
    this.embeddings = new OpenAIEmbeddings({model: "text-embedding-3-large", dimensions: 1024});
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async agent(){
    const pineconeService = new PineconeService("shopify", "OBEY Clothing")
    
    const pineconeIndex = await pineconeService.createIndex();
    
    const vectorStore = await PineconeStore.fromExistingIndex(this.embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    });
    
    const retriever = vectorStore.asRetriever({k:2});

    let answerTemplate = `your are a chat bot of shopify answer the user {question}`;

    let answerPrompt = PromptTemplate.fromTemplate(answerTemplate);

    let answerChain = answerPrompt.pipe(this.llm).pipe(new StringOutputParser()).pipe(retriever);

    let response = await answerChain.invoke({question: "hello"})
    console.log(response);

    if (response?.response_metadata?.tokenUsage) {
      fs.writeFileSync("token_usage.log", JSON.stringify(response.response_metadata.tokenUsage));
    }

  }  
}

let ai = new Ai();

ai.agent();
// export default Ai;
