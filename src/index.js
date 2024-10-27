import express from 'express';
import bodyParser from 'body-parser';
import aiRouter from './controller/aicontroller.js'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use('/api', aiRouter);

app.get("/", (req, res) => {
    return res.json({ hello: "world" });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
