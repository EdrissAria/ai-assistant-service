import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

class Ai {
  constructor() {
    this.embeddings = new OpenAIEmbeddings();
    this.llm = new ChatOpenAI({
      model: "gpt-4",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embed_product(products) {}

  async agent(
    productVectorstore,
    fileVectorstore,
    linkVectorstore,
    qaVectorstore,
    settings,
    question
  ) {
    const productRetriever = productVectorstore.asRetriever({
      searchType: "similarity",
    });
    const qaRetriever = qaVectorstore.asRetriever({ searchType: "similarity" });
    const linkRetriever = linkVectorstore.asRetriever({
      searchType: "similarity",
    });
    const fileRetriever = fileVectorstore.asRetriever({
      searchType: "similarity",
    });

    function combineDocs(docs) {
      return docs.map((doc) => doc.pageContent).join("\n\n");
    }

    const template = `You are a clothing sales assistant chatbot for Shopify. Answer questions concisely, accurately, and with a touch of humor. Use tools for relevant information when needed.

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

    const productRetrieverChain = RunnableSequence.from([
      productRetriever,
      combineDocs,
    ]);
    const qaRetrieverChain = RunnableSequence.from([qaRetriever, combineDocs]);
    const linkRetrieverChain = RunnableSequence.from([
      linkRetriever,
      combineDocs,
    ]);
    const fileRetrieverChain = RunnableSequence.from([
      fileRetriever,
      combineDocs,
    ]);

    const combinedRetrieverChain = async (question) => {
      const [productContext, qaContext, linkContext, fileContext] =
        await Promise.all([
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

    const answerChain = answerPrompt
      .pipe(this.llm)
      .pipe(new StringOutputParser());

    const chain = RunnableSequence.from([combinedRetrieverChain, answerChain]);

    const translatedQuestion = await this.translateToEnglish(
      question,
      settings.language
    );
    const response = await chain.invoke(question);
    const cleanedResponse = response.replace(/\n/g, "");

    const productResponseOriginal =
      await productVectorstore.similaritySearchWithScore(question, 10);
    const productResponseTranslated =
      await productVectorstore.similaritySearchWithScore(
        translatedQuestion,
        10
      );

    const combinedResults = [
      ...productResponseOriginal,
      ...productResponseTranslated,
    ].filter(([_, score]) => score >= 0.73);

    const uniqueResults = new Map();
    combinedResults.forEach(([doc, score]) => {
      if (!uniqueResults.has(doc.pageContent)) {
        uniqueResults.set(doc.pageContent, { doc, score });
      }
    });

    const products = Array.from(uniqueResults.values()).map(({ doc }) => ({
      ...doc,
      pageContent: doc.pageContent.replace(/\n/g, ""),
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
      const descriptionMatch = product.pageContent.match(
        /Its description is (.+?) and/
      );
      const priceMatch = product.pageContent.match(/price: ([0-9.]+),/);
      const imageMatch = product.pageContent.match(
        /Image:(https:\/\/.+?)(?:\s|$)/
      );

      return {
        name: nameMatch ? nameMatch[1] : "Unknown Product",
        description: descriptionMatch
          ? descriptionMatch[1]
          : "No description available",
        price: priceMatch ? parseFloat(priceMatch[1]) : "Unknown Price",
        image: imageMatch ? imageMatch[1].trim() : null,
      };
    });
  }
}

export default Ai;
