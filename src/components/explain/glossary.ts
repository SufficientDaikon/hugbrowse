export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
  related?: string[];
}

export const glossary: GlossaryEntry[] = [
  {
    term: "Parameters",
    short: "Numbers the model learned during training",
    long: 'Parameters are the numerical values a model learns during training. A "7B" model has 7 billion parameters. More parameters generally means smarter, but requires more memory to run.',
    related: ["VRAM", "Quantization"],
  },
  {
    term: "Quantization",
    short: "Shrinking a model by using less precise numbers",
    long: "Quantization reduces model size by using fewer bits per number. Like JPEG compression for AI — the model gets smaller with a slight quality trade-off. A 7B model at FP16 needs ~14GB, but at Q4 only needs ~3.5GB.",
    related: ["GGUF", "Parameters"],
  },
  {
    term: "GGUF",
    short: "A file format for running AI on regular computers",
    long: "GGUF (GPT-Generated Unified Format) is a file format designed for running AI models efficiently on consumer hardware, especially CPUs. It supports various quantization levels and is used by llama.cpp and Ollama.",
    related: ["Quantization", "llama.cpp"],
  },
  {
    term: "Safetensors",
    short: "A safe file format for AI model weights",
    long: "Safetensors is a file format for storing model weights that is both fast to load and safe — it cannot contain hidden executable code, unlike pickle-based formats.",
    related: ["Parameters", "GGUF"],
  },
  {
    term: "Fine-tuned",
    short: "A model further trained on specific data",
    long: "Fine-tuning takes a pre-trained model and trains it further on specific data to make it better at a particular task. Like teaching a general doctor to specialize in cardiology.",
    related: ["LoRA", "Base Model"],
  },
  {
    term: "LoRA",
    short: "A lightweight add-on that customizes a model",
    long: "LoRA (Low-Rank Adaptation) adds small trainable layers to a frozen model. It's like a mod for a video game — it customizes behavior without changing the entire model. LoRA files are typically 10-100MB vs the full model's many GB.",
    related: ["Fine-tuned", "Parameters"],
  },
  {
    term: "VRAM",
    short: "Your graphics card's memory",
    long: "VRAM (Video RAM) is the dedicated memory on your graphics card. AI models run much faster on GPU (using VRAM) than CPU (using RAM). More VRAM = bigger models you can run at full speed.",
    related: ["Parameters", "Quantization"],
  },
  {
    term: "Inference",
    short: "Using a trained model to get results",
    long: "Inference is the process of using a trained model to make predictions or generate output. When you chat with an AI or generate an image, that's inference. It requires loading the model into memory.",
    related: ["Parameters", "VRAM"],
  },
  {
    term: "FP16",
    short: "Half-precision numbers (16 bits)",
    long: "FP16 (float16) uses 16 bits per number instead of 32. This halves memory usage with minimal quality loss. Most modern models are distributed in FP16 or BF16 format.",
    related: ["BF16", "Quantization", "FP32"],
  },
  {
    term: "BF16",
    short: "Brain floating point (16 bits)",
    long: "BF16 (bfloat16) is a 16-bit format designed by Google Brain. It has the same range as FP32 but less precision. It's often preferred for training and is as memory-efficient as FP16.",
    related: ["FP16", "FP32"],
  },
  {
    term: "FP32",
    short: "Full-precision numbers (32 bits)",
    long: "FP32 (float32) uses 32 bits per parameter — full precision. It's the most accurate but uses the most memory. A 7B parameter model in FP32 needs ~28GB of memory.",
    related: ["FP16", "Quantization"],
  },
  {
    term: "Context Length",
    short: "How much text the model can process at once",
    long: "Context length is the maximum number of tokens a model can handle in a single conversation. 4096 tokens ≈ ~3000 words. Longer context = can handle bigger documents, but uses more memory.",
    related: ["Tokens", "Inference"],
  },
  {
    term: "Tokens",
    short: "Small chunks of text (words or word pieces)",
    long: 'Tokens are the basic units models work with. A token is roughly ¾ of a word in English. "ChatGPT is amazing" = 4 tokens. Models have a maximum number of tokens they can process at once (context length).',
    related: ["Context Length"],
  },
  {
    term: "Transformer",
    short: "The architecture behind most modern AI models",
    long: 'Transformers are a type of neural network architecture that processes data using "attention" mechanisms. Nearly all large language models (GPT, LLaMA, Mistral) and many image models use this architecture.',
    related: ["Parameters", "Attention"],
  },
  {
    term: "Diffusion",
    short: "How AI image generators work",
    long: "Diffusion models generate images by starting with random noise and gradually removing it to form a coherent image, guided by a text prompt. Stable Diffusion and DALL-E use this approach.",
    related: ["Text-to-Image"],
  },
  {
    term: "Pipeline",
    short: "A pre-built workflow for a specific task",
    long: "A pipeline is a ready-to-use wrapper that handles all the steps needed for a specific task — like text generation, translation, or image classification. You give it input, it gives you output.",
    related: ["Inference"],
  },
  {
    term: "Embeddings",
    short: "Numbers that represent meaning",
    long: "Embeddings convert text, images, or other data into lists of numbers (vectors) that capture meaning. Similar concepts end up close together in this number space, enabling search and comparison.",
    related: ["Feature Extraction", "Sentence Similarity"],
  },
  {
    term: "Base Model",
    short: "The original pre-trained model before customization",
    long: "A base model is trained on a large general dataset. It's the starting point before fine-tuning for specific tasks. Examples: LLaMA 3, Mistral 7B base.",
    related: ["Fine-tuned", "LoRA"],
  },
  {
    term: "Attention",
    short: "How models focus on relevant parts of input",
    long: 'Attention mechanisms let models weigh the importance of different parts of the input. When translating "The cat sat on the mat", attention helps the model know "cat" relates to "sat".',
    related: ["Transformer", "Context Length"],
  },
  {
    term: "ONNX",
    short: "A universal format for AI models",
    long: "ONNX (Open Neural Network Exchange) is a format that lets models work across different frameworks. A model trained in PyTorch can be converted to ONNX and run in TensorFlow or specialized runtimes.",
    related: ["Safetensors", "GGUF"],
  },
  {
    term: "Gated Model",
    short: "A model that requires access approval",
    long: "Gated models require you to agree to terms or get approval before downloading. Common for powerful models like LLaMA where Meta wants to track who uses them.",
    related: ["API Token"],
  },
  {
    term: "API Token",
    short: "A password that identifies you to HuggingFace",
    long: "An API token (access token) is a secret key that proves your identity to the HuggingFace API. You need one to access gated models, private repos, and to get higher rate limits.",
    related: ["Gated Model"],
  },
  {
    term: "MLX",
    short: "Apple's framework for running AI on Mac",
    long: "MLX is Apple's machine learning framework optimized for Apple Silicon (M1/M2/M3/M4). It uses unified memory efficiently, making it great for running models on Macs.",
    related: ["GGUF", "Inference"],
  },
  {
    term: "CPU Offloading",
    short: "Running part of a model on CPU when GPU is too small",
    long: "When a model is too large for your GPU, some layers can be offloaded to CPU/RAM. The model runs slower than full GPU, but faster than full CPU. Common with llama.cpp.",
    related: ["VRAM", "Quantization"],
  },
  {
    term: "KV Cache",
    short: "Memory used to speed up text generation",
    long: "KV (Key-Value) cache stores intermediate calculations during text generation so the model doesn't recalculate everything for each new token. It uses extra memory on top of the model itself.",
    related: ["Context Length", "VRAM", "Inference"],
  },
];

// Build a lookup map for quick access
export const glossaryMap = new Map(
  glossary.map((e) => [e.term.toLowerCase(), e]),
);

// All terms as regex pattern for auto-detection
export const glossaryTermPattern = new RegExp(
  `\\b(${glossary.map((e) => e.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);
