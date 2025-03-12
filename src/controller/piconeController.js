import express from "express";
import {insertSchema, updateSchema, deleteSchema} from "../validators/productValidator.js";
import PineconeService from "../services/PineconeService.js";
import vine from "@vinejs/vine";

const router = express.Router();

router.post("/pinecone-insert", async (req, res) => {
  try {
    const validator = vine.compile(insertSchema);
    const output = await validator.validate(req.body);

    new PineconeService(
      output.platform,
      output.vendor
    ).insertdata(output.products);

    return res
      .status(200)
      .json({ message: "Products successfully stored in Pinecone" });
  } catch (error) {
    return res.status(400).json({ error: error.messages });
  }
});

router.post("/pinecone-get-data", async (req, res) => {
  let {platform, vendor, query} = req.body
  let data = new PineconeService(platform, vendor).getVectordata(query);

  res.json(data);
});

router.post("/pinecone-update", async (req, res) => {
  const validator = vine.compile(updateSchema);
  const {platform, vendor, product} = await validator.validate(req.body);
  let updated = new PineconeService(platform, vendor).updateVectordata(product);

  res.json(updated);
});

router.post("/pinecone-delete", async (req, res) => {
  const validator = vine.compile(deleteSchema);
  const {platform, vendor, id} = await validator.validate(req.body);
  let deleted = new PineconeService(platform, vendor).deleteVectordata(id);

  res.json(deleted);
});

export default router;
