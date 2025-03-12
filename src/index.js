import express from 'express';
import bodyParser from 'body-parser';
import PineconeRouter from './controller/piconeController.js'; 


const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use('/api', PineconeRouter);

app.get("/", (req, res) => {
    return res.json({ hello: "world" });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
