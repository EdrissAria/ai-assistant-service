import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import axios from 'axios';
import * as cheerio from 'cheerio';
import downloadAndParseFile from './DownloadAndParseFiles.js';

class Ai {
  constructor() {
    this.embeddings = new OpenAIEmbeddings();
    this.llm = new ChatOpenAI({
      model: 'gpt-4',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embed_product(products) {
    const product_json = JSON.parse(JSON.stringify(products));

    let product_docs = [];
    for (let product of product_json) {
      let tags = product.tags ? product.tags.toString() : '';
      let description = product.body_html ? product.body_html : 'No description available';
      let product_doc = `This is a ${product.title}. Its description is ${description} and its vendor is ${product.vendor} and its product_type is ${product.product_type}. This product has these tags: ${tags}.`;

      let variants_doc = '';
      if (product.variants && product.variants.length > 0) {
        for (let variant of product.variants) {
          let variant_doc = '(';
          for (let i = 0; i < product.options.length; i++) {
            variant_doc += `${product.options[i].name}: ${variant['option' + (i + 1)]}, `;
          }
          let s = `price: ${variant.price}, weight: ${variant.grams})`;
          variant_doc += s;
          variants_doc += variant_doc + '\n';
        }
      } else {
        variants_doc = 'No variants available.';
      }
      product_doc += `\nThis product is available in these variants:\n${variants_doc}`;

      let image_doc = 'Image:\n';
      if (product.image && product.image.src) {
        image_doc += `${product.image.src}\n`;
      } else {
        image_doc += 'No image available.';
      }
      product_doc += image_doc;

      product_docs.push(product_doc);
    }

    const productVstore = await MemoryVectorStore.fromTexts(product_docs, [], this.embeddings);
    return productVstore;
  }

  async embed_qa(questionAnswers) {
    const qa_json = JSON.parse(JSON.stringify(questionAnswers));

    let qa_docs = [];
    for (let qa of qa_json) {
      let qa_doc = `Question: ${qa.question}\nAnswer: ${qa.answer}`;
      qa_docs.push(qa_doc);
    }

    const qaVstore = await MemoryVectorStore.fromTexts(qa_docs, [], this.embeddings);
    return qaVstore;
  }

  async fetchLinkContent(url) {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const content = {
        titles: [],
        paragraphs: [],
      };

      $('title').each((_, element) => {
        content.titles.push($(element).text());
      });

      $('p').each((_, element) => {
        content.paragraphs.push($(element).text());
      });

      return JSON.stringify(content);
    } catch (error) {
      console.error('Error fetching data:', error);
      return;
    }
  }

  async embed_links(links) {
    const links_json = JSON.parse(JSON.stringify(links));

    const linkDocsPromises = links_json.map(async (link) => {
      const content = await this.fetchLinkContent(link.url);
      return `URL: ${link.url}\nContent: ${content}`;
    });

    const link_docs = await Promise.all(linkDocsPromises);

    const linkVstore = await MemoryVectorStore.fromTexts(link_docs, [], this.embeddings);
    return linkVstore;
  }

  async fetchFileContent(url, type) {
    try {
      let content = await downloadAndParseFile(url, type);
      return content;
    } catch (error) {
      console.error('Error fetching file data:', error);
      return;
    }
  }

  async embed_files(files) {
    const files_json = JSON.parse(JSON.stringify(files));

    const fileDocsPromises = files_json.map(async (file) => {
      const content = await this.fetchFileContent(file.url, file.type);
      return `File ID: ${file.url}\nContent: ${content}`;
    });

    const file_docs = await Promise.all(fileDocsPromises);

    const fileVstore = await MemoryVectorStore.fromTexts(file_docs, [], this.embeddings);
    return fileVstore;
  }

  async translateToEnglish(text, targetLanguage) {
    if (targetLanguage.toLowerCase() === 'english') return text;
    const prompt = new PromptTemplate({
      template: 'Translate this to English: {text}',
      inputVariables: ['text'],
    });
    const translationChain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    return await translationChain.invoke({ text });
  }

  async agent(productVectorstore, fileVectorstore, linkVectorstore, qaVectorstore, settings, question) {
    const productRetriever = productVectorstore.asRetriever({ searchType: 'similarity' });
    const qaRetriever = qaVectorstore.asRetriever({ searchType: 'similarity' });
    const linkRetriever = linkVectorstore.asRetriever({ searchType: 'similarity' });
    const fileRetriever = fileVectorstore.asRetriever({ searchType: 'similarity' });

    function combineDocs(docs) {
      return docs.map((doc) => doc.pageContent).join('\n\n');
    }

    const template = 
    `You are a clothing sales assistant chatbot for Shopify. Answer questions concisely, accurately, and with a touch of humor. Use tools for relevant information when needed.

    Guidelines:
    1. If you don't know the answer, say, "I do not know the answer to this question."
    2. Be ${settings.voiceTone}. 
    3. Use Emoji: ${settings.useEmoji}.
    4. Answer Length: ${settings.answerLength}.
    5. Language: ${settings.language}.

    Response Format:
    question: {question}
    contexts: {product_context}, {qa_context}, {link_context}, {file_context}
    answer:
    - Include product details if available. If similarity score < 0.73, say "We don't have any products that match your query."
    - For more info from a link, use "FETCH_CONTENT_FROM_URL: [URL]".`;

    const answerPrompt = PromptTemplate.fromTemplate(template);

    const productRetrieverChain = RunnableSequence.from([productRetriever, combineDocs]);
    const qaRetrieverChain = RunnableSequence.from([qaRetriever, combineDocs]);
    const linkRetrieverChain = RunnableSequence.from([linkRetriever, combineDocs]);
    const fileRetrieverChain = RunnableSequence.from([fileRetriever, combineDocs]);

    const combinedRetrieverChain = async (question) => {
      const [productContext, qaContext, linkContext, fileContext] = await Promise.all([
        productRetrieverChain.invoke(question),
        qaRetrieverChain.invoke(question),
        linkRetrieverChain.invoke(question),
        fileRetrieverChain.invoke(question),
      ]);

      return {
        question,
        product_context: productContext,
        qa_context: qaContext,
        link_context: linkContext,
        file_context: fileContext,
      };
    };

    const answerChain = answerPrompt.pipe(this.llm).pipe(new StringOutputParser());

    const chain = RunnableSequence.from([combinedRetrieverChain, answerChain]);

    const translatedQuestion = await this.translateToEnglish(question, settings.language);
    const response = await chain.invoke(question);
    const cleanedResponse = response.replace(/\n/g, '');

    const productResponseOriginal = await productVectorstore.similaritySearchWithScore(question, 10);
    const productResponseTranslated = await productVectorstore.similaritySearchWithScore(translatedQuestion, 10);

    const combinedResults = [...productResponseOriginal, ...productResponseTranslated].filter(
      ([_, score]) => score >= 0.73
    );

    const uniqueResults = new Map();
    combinedResults.forEach(([doc, score]) => {
      if (!uniqueResults.has(doc.pageContent)) {
        uniqueResults.set(doc.pageContent, { doc, score });
      }
    });

    const products = Array.from(uniqueResults.values()).map(({ doc }) => ({
      ...doc,
      pageContent: doc.pageContent.replace(/\n/g, ''),
    }));

    let formatProducts = await this.formatProducts(products, settings.shop);

    return {
      response: cleanedResponse,
      products: formatProducts,
    };
  }

  async formatProducts(products, shop) {
    return products.map((product) => {
      const nameMatch = product.pageContent.match(/This is a (.+?)\./);
      const descriptionMatch = product.pageContent.match(/Its description is (.+?) and/);
      const priceMatch = product.pageContent.match(/price: ([0-9.]+),/);
      const imageMatch = product.pageContent.match(/Image:(https:\/\/.+?)(?:\s|$)/); // Updated regex for image URL

      return {
        name: nameMatch ? nameMatch[1] : 'Unknown Product',
        description: descriptionMatch ? descriptionMatch[1] : 'No description available',
        price: priceMatch ? parseFloat(priceMatch[1]) : 'Unknown Price',
        image: imageMatch ? imageMatch[1].trim() : null,
      };
    });
  }
}

export default Ai;
