require("dotenv").config();

const express = require("express");
const path = require("path");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = "amazon.nova-micro-v1:0";
const MAX_PROMPT_CHARS = 4000;

const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
  maxAttempts: 3,
});

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    region: AWS_REGION,
    modelId: MODEL_ID,
  });
});

app.post("/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(400).json({
      error: `Prompt is too long. Keep it under ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const requestBody = {
    inferenceConfig: {
      maxTokens: 700,
      temperature: 0.7,
    },
    messages: [
      {
        role: "user",
        content: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(JSON.stringify(requestBody)),
    });

    const response = await bedrockClient.send(command);
    const decodedResponse = new TextDecoder().decode(response.body);
    const parsedResponse = JSON.parse(decodedResponse);

    const generatedText =
      parsedResponse.output?.message?.content
        ?.map((item) => item.text)
        .filter(Boolean)
        .join("\n")
        .trim() || "No text response was returned by the model.";

    return res.status(200).json({
      response: generatedText,
      modelId: MODEL_ID,
      usage: parsedResponse.usage,
    });
  } catch (error) {
    console.error("Bedrock invocation failed:", {
      name: error.name,
      message: error.message,
      metadata: error.$metadata,
    });

    const statusCode = error.$metadata?.httpStatusCode || 500;
    const clientMessage = buildClientErrorMessage(error);

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: clientMessage,
      requestId: error.$metadata?.requestId,
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error("Unexpected server error:", error);
  res.status(500).json({ error: "Unexpected server error." });
});

function buildClientErrorMessage(error) {
  if (error.name === "AccessDeniedException") {
    return "Access denied. Check the EC2 IAM role permissions and Bedrock model access.";
  }

  if (error.name === "ValidationException") {
    return "Bedrock rejected the request. Check the model ID, region, and request format.";
  }

  if (error.name === "ThrottlingException" || error.name === "ServiceQuotaExceededException") {
    return "Bedrock throttled the request or a quota was exceeded. Try again later.";
  }

  if (error.name === "CredentialsProviderError") {
    return "AWS credentials were not found. Attach the IAM role to the EC2 instance.";
  }

  return "Unable to generate a response from Amazon Bedrock.";
}

app.listen(PORT, HOST, () => {
  console.log(`Bedrock app listening on http://${HOST}:${PORT}`);
  console.log(`AWS Region: ${AWS_REGION}`);
  console.log(`Model ID: ${MODEL_ID}`);
});
