use clap::{Parser, Subcommand};
use serde::Serialize;

mod client;

#[derive(Parser)]
#[command(name = "hb", about = "HugBrowse CLI — local LLM model manager", version)]
struct Cli {
    /// API server base URL
    #[arg(long, default_value = "http://127.0.0.1:8080", global = true)]
    url: String,

    /// Output format
    #[arg(long, default_value = "text", global = true)]
    format: OutputFormat,

    /// Suppress non-essential output
    #[arg(long, global = true)]
    quiet: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Clone, clap::ValueEnum)]
enum OutputFormat {
    Text,
    Json,
}

#[derive(Subcommand)]
enum Commands {
    /// Interactive chat or one-off prompt
    Chat {
        /// Model identifier (optional — uses first loaded model)
        model: Option<String>,
        /// One-off prompt (non-interactive)
        #[arg(short, long)]
        prompt: Option<String>,
        /// System prompt
        #[arg(short, long)]
        system: Option<String>,
        /// Show token stats after response
        #[arg(long)]
        stats: bool,
    },
    /// List downloaded models
    Ls,
    /// List loaded (in-memory) models
    Ps,
    /// Load a model
    Load {
        /// Model path or identifier
        model: String,
        /// GPU offload (0.0-1.0 or 'max')
        #[arg(long)]
        gpu: Option<String>,
        /// Context length
        #[arg(long, default_value = "4096")]
        context_length: u32,
        /// TTL in seconds (0 = no auto-unload)
        #[arg(long, default_value = "3600")]
        ttl: u64,
    },
    /// Unload a model or all models
    Unload {
        /// Model identifier (omit for --all)
        model: Option<String>,
        /// Unload all models
        #[arg(long)]
        all: bool,
    },
    /// API server control
    Server {
        #[command(subcommand)]
        action: ServerAction,
    },
}

#[derive(Subcommand)]
enum ServerAction {
    /// Show API server status
    Status,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let client = client::HbClient::new(&cli.url);

    let result = match cli.command {
        Commands::Chat { model, prompt, system, stats } => {
            cmd_chat(&client, model, prompt, system, stats, &cli.format, cli.quiet).await
        }
        Commands::Ls => cmd_ls(&client, &cli.format).await,
        Commands::Ps => cmd_ps(&client, &cli.format).await,
        Commands::Load { model, gpu, context_length, ttl } => {
            cmd_load(&client, &model, gpu, context_length, ttl, &cli.format).await
        }
        Commands::Unload { model, all } => {
            cmd_unload(&client, model, all, &cli.format).await
        }
        Commands::Server { action } => match action {
            ServerAction::Status => cmd_server_status(&client, &cli.format).await,
        },
    };

    if let Err(e) = result {
        if !cli.quiet {
            eprintln!("Error: {}", e);
        }
        std::process::exit(1);
    }
}

// ─── Commands ───────────────────────────────────────────────────────────

async fn cmd_chat(
    client: &client::HbClient,
    model: Option<String>,
    prompt: Option<String>,
    system: Option<String>,
    _stats: bool,
    format: &OutputFormat,
    quiet: bool,
) -> Result<(), String> {
    let prompt = prompt.ok_or_else(|| "Use -p to provide a prompt (interactive mode not yet supported)".to_string())?;

    let model_id = if let Some(m) = model {
        m
    } else {
        // Use first loaded model
        let models = client.list_models().await?;
        models.first()
            .map(|m| m.id.clone())
            .ok_or_else(|| "No models loaded. Load a model first with `hb load <model>`".to_string())?
    };

    let messages = build_messages(system.as_deref(), &prompt);

    let response = client.chat_completion(&model_id, &messages).await?;

    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&response).unwrap_or_default());
        }
        OutputFormat::Text => {
            if !quiet {
                if let Some(choice) = response.choices.first() {
                    println!("{}", choice.message.content);
                }
            }
        }
    }

    Ok(())
}

async fn cmd_ls(client: &client::HbClient, format: &OutputFormat) -> Result<(), String> {
    let models = client.list_models().await?;
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&models).unwrap_or_default());
        }
        OutputFormat::Text => {
            if models.is_empty() {
                println!("No models available.");
            } else {
                println!("{:<40} {:<10}", "MODEL", "OWNER");
                println!("{}", "-".repeat(50));
                for m in &models {
                    println!("{:<40} {:<10}", m.id, m.owned_by);
                }
            }
        }
    }
    Ok(())
}

async fn cmd_ps(client: &client::HbClient, format: &OutputFormat) -> Result<(), String> {
    let status = client.get_status().await?;
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&status).unwrap_or_default());
        }
        OutputFormat::Text => {
            if let Some(models) = status.get("loaded_models").and_then(|v| v.as_array()) {
                if models.is_empty() {
                    println!("No models loaded.");
                } else {
                    println!("{:<30} {:<10} {:<10}", "MODEL", "STATUS", "PORT");
                    println!("{}", "-".repeat(50));
                    for m in models {
                        let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("?");
                        let status = m.get("status").and_then(|v| v.as_str()).unwrap_or("?");
                        let port = m.get("port").and_then(|v| v.as_u64()).unwrap_or(0);
                        println!("{:<30} {:<10} {:<10}", id, status, port);
                    }
                }
            } else {
                println!("Server running. Use `hb ls` to list available models.");
            }
        }
    }
    Ok(())
}

async fn cmd_load(
    client: &client::HbClient,
    model: &str,
    _gpu: Option<String>,
    context_length: u32,
    _ttl: u64,
    format: &OutputFormat,
) -> Result<(), String> {
    let result = client.load_model(model, context_length).await?;
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&result).unwrap_or_default());
        }
        OutputFormat::Text => {
            println!("✓ Model '{}' loading initiated.", model);
        }
    }
    Ok(())
}

async fn cmd_unload(
    client: &client::HbClient,
    model: Option<String>,
    _all: bool,
    format: &OutputFormat,
) -> Result<(), String> {
    let model = model.ok_or_else(|| "Specify a model to unload (--all not yet supported via API)".to_string())?;
    let result = client.unload_model(&model).await?;
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&result).unwrap_or_default());
        }
        OutputFormat::Text => {
            println!("✓ Model '{}' unloaded.", model);
        }
    }
    Ok(())
}

async fn cmd_server_status(client: &client::HbClient, format: &OutputFormat) -> Result<(), String> {
    let status = client.get_status().await?;
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&status).unwrap_or_default());
        }
        OutputFormat::Text => {
            let running = status.get("running").and_then(|v| v.as_bool()).unwrap_or(false);
            let version = status.get("version").and_then(|v| v.as_str()).unwrap_or("?");
            println!("Server: {}", if running { "running" } else { "stopped" });
            println!("Version: {}", version);
        }
    }
    Ok(())
}

// ─── Helpers ────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

fn build_messages(system: Option<&str>, prompt: &str) -> Vec<ChatMessage> {
    let mut msgs = Vec::new();
    if let Some(sys) = system {
        msgs.push(ChatMessage { role: "system".to_string(), content: sys.to_string() });
    }
    msgs.push(ChatMessage { role: "user".to_string(), content: prompt.to_string() });
    msgs
}
