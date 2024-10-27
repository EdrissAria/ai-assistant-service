import express from 'express';
import Ai from '../services/Ai.js';

const router = express.Router();

router.post('/ai-response', async (req, res) => {
    const { products, files, links, qaData, settings, question } = req.body;

    try {
        const productVstore = await Ai.embed_product(products);
        const fileVstore = await Ai.embed_files(files);
        const linkVstore = await Ai.embed_links(links);
        const qaVstore = await Ai.embed_qa(qaData);

        const result = await Ai.agent(productVstore, fileVstore, linkVstore, qaVstore, settings, question);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: 'Agent failed to process embeddings', error: error.message });
    }
});

export default router;