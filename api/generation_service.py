"""Image generation service - reuses existing generation logic from frontend"""

import httpx
import base64
from pathlib import Path
from datetime import datetime
import re
import os
import logging

logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
BETA_DIR = BASE_DIR / "beta"
TO_BE_PROCESSED_DIR = BETA_DIR / "to-be-processed"

# Ensure directory exists
TO_BE_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def get_api_keys() -> tuple[str, str]:
    """Get API keys from environment"""
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    oai_key = os.environ.get("OPENAI_API_KEY", "")
    return or_key, oai_key


async def generate_image(
    prompt: str,
    model: str,
    refs: list[str] = None,
    aspect: str = "1:1",
    quality: str = "medium"
) -> dict:
    """
    Generate image using configured AI models.

    Args:
        prompt: Text prompt for generation
        model: Model identifier (e.g., "Gemini 3", "GPT Image", "Flux 2")
        refs: List of reference image URLs
        aspect: Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
        quality: Quality level (low, medium, high)

    Returns:
        dict with filename and path of saved image
    """
    refs = refs or []

    # Map friendly model names to API model IDs
    model_map = {
        "Gemini 3": "google/gemini-3-pro-image-preview",
        "GPT Image": "gpt-image-1.5",
        "Flux 2": "black-forest-labs/flux.2-pro",
    }
    model_id = model_map.get(model, model)

    if "gpt-image" in model_id.lower() or model == "GPT Image":
        image_data = await generate_with_openai(prompt, refs, quality, aspect)
    else:
        image_data = await generate_with_openrouter(model_id, prompt, refs, aspect, quality)

    # Save to disk
    filename = save_image_to_disk(image_data, prompt, model_id)

    return {
        "filename": f"to-be-processed/{filename}",
        "path": str(TO_BE_PROCESSED_DIR / filename)
    }


async def generate_with_openrouter(
    model: str,
    prompt: str,
    refs: list[str],
    aspect: str,
    quality: str
) -> str:
    """Generate via OpenRouter (Gemini, Flux)"""
    or_key, _ = get_api_keys()

    if not or_key:
        raise ValueError("OPENROUTER_API_KEY not set")

    content = []

    # Add reference images as base64 if provided
    if refs:
        async with httpx.AsyncClient(timeout=60) as client:
            for ref_url in refs:
                try:
                    resp = await client.get(ref_url)
                    resp.raise_for_status()
                    b64 = base64.b64encode(resp.content).decode()
                    mime = resp.headers.get("content-type", "image/png")
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"}
                    })
                except Exception as e:
                    logger.warning(f"Failed to fetch reference image {ref_url}: {e}")

    # Add prompt text
    prompt_text = f"Using the reference images: {prompt}" if refs else prompt
    content.append({"type": "text", "text": prompt_text})

    # Quality configuration
    quality_config = {
        "low": {"gemini_size": "1K", "flux_steps": 15},
        "medium": {"gemini_size": "1K", "flux_steps": 28},
        "high": {"gemini_size": "2K", "flux_steps": 50}
    }.get(quality, {"gemini_size": "1K", "flux_steps": 28})

    request_body = {
        "model": model,
        "messages": [{"role": "user", "content": content if refs else prompt}],
        "modalities": ["text", "image"],
        "image_config": {"aspect_ratio": aspect}
    }

    if "gemini" in model.lower():
        request_body["image_config"]["image_size"] = quality_config["gemini_size"]
    elif "flux" in model.lower():
        request_body["provider"] = {
            "flux": {"num_inference_steps": quality_config["flux_steps"]}
        }

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {or_key}",
                "Content-Type": "application/json"
            },
            json=request_body
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract image from response
    message = data.get("choices", [{}])[0].get("message", {})

    if "images" in message and message["images"]:
        img = message["images"][0]
        if isinstance(img, dict):
            return img.get("image_url", {}).get("url", "") or img.get("url", "")
        return img

    # Check for inline image in content
    if message.get("content"):
        for part in message["content"] if isinstance(message["content"], list) else []:
            if isinstance(part, dict) and part.get("type") == "image_url":
                return part.get("image_url", {}).get("url", "")

    raise ValueError("No image in OpenRouter response")


async def generate_with_openai(
    prompt: str,
    refs: list[str],
    quality: str,
    aspect: str
) -> str:
    """Generate via OpenAI GPT Image"""
    _, oai_key = get_api_keys()

    if not oai_key:
        raise ValueError("OPENAI_API_KEY not set")

    # Map aspect ratio to size
    size_map = {
        "1:1": "1024x1024",
        "16:9": "1792x1024",
        "9:16": "1024x1792",
        "4:3": "1024x1024",  # Fallback to square
        "3:4": "1024x1024",  # Fallback to square
    }
    size = size_map.get(aspect, "1024x1024")

    # Map quality
    oai_quality = "hd" if quality == "high" else "standard"

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {oai_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-image-1",
                "prompt": prompt,
                "n": 1,
                "size": size,
                "quality": oai_quality,
                "response_format": "b64_json"
            }
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract image data
    image_data = data.get("data", [{}])[0]

    if image_data.get("url"):
        return image_data["url"]
    elif image_data.get("b64_json"):
        return f"data:image/png;base64,{image_data['b64_json']}"

    raise ValueError("No image in OpenAI response")


def save_image_to_disk(image_data: str, prompt: str, model: str) -> str:
    """Save base64/URL image to disk, return filename"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Clean prompt for filename (first 30 chars)
    clean_prompt = re.sub(r'[^a-zA-Z0-9\s]', '', prompt)[:30]
    clean_prompt = clean_prompt.strip().replace(' ', '-').lower()
    if not clean_prompt:
        clean_prompt = "generated"

    # Get model short name
    model_short = model.split('/')[-1].split('-')[0][:10]

    filename = f"{timestamp}_{model_short}_{clean_prompt}.png"
    filepath = TO_BE_PROCESSED_DIR / filename

    # Handle URL - download first
    if image_data.startswith('http'):
        import httpx
        resp = httpx.get(image_data, timeout=60)
        resp.raise_for_status()
        filepath.write_bytes(resp.content)
        logger.info(f"Saved image from URL: {filename}")
        return filename

    # Handle data URL
    if image_data.startswith('data:'):
        image_data = image_data.split(',')[1]

    # Decode base64 and save
    filepath.write_bytes(base64.b64decode(image_data))
    logger.info(f"Saved image from base64: {filename}")
    return filename


async def generate_caption(
    image_path: str,
    platforms: list[str] = None,
    context: str = None
) -> dict:
    """
    Generate social media caption and hashtags for an image using Gemini.

    Args:
        image_path: Path to the image file (relative to beta/)
        platforms: Target platforms (Instagram, X, LinkedIn)
        context: Optional context about the image/character

    Returns:
        dict with caption and hashtags
    """
    or_key, _ = get_api_keys()
    if not or_key:
        raise ValueError("OPENROUTER_API_KEY not set")

    platforms = platforms or ["Instagram"]
    platform_str = ", ".join(platforms)

    # Load image as base64
    full_path = BETA_DIR / image_path
    if not full_path.exists():
        raise ValueError(f"Image not found: {image_path}")

    with open(full_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    # Detect mime type
    mime = "image/png"
    if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg"):
        mime = "image/jpeg"
    elif image_path.lower().endswith(".webp"):
        mime = "image/webp"

    # Build the prompt
    prompt = f"""You are a social media content creator for an AI-generated lifestyle influencer named Naina.

Analyze this image and generate an engaging social media post for: {platform_str}

Guidelines:
- Write in first person as Naina (she/her)
- Be authentic, warm, and relatable
- Keep the caption concise but engaging (2-4 sentences)
- Match the tone to the image mood
- For Instagram: can be slightly longer, storytelling works
- For X/Twitter: keep it punchy, under 280 chars ideally
- For LinkedIn: more professional but still personable

{f"Additional context: {context}" if context else ""}

Respond in this exact JSON format:
{{
  "caption": "Your engaging caption here",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5"
}}

Generate 5-8 relevant hashtags. Include a mix of popular and niche tags."""

    content = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{image_data}"}
        },
        {"type": "text", "text": prompt}
    ]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {or_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "google/gemini-2.5-flash",
                "messages": [{"role": "user", "content": content}],
            }
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract response text
    message = data.get("choices", [{}])[0].get("message", {})
    text = message.get("content", "")

    # Parse JSON from response
    import json
    try:
        # Try to find JSON in the response
        json_match = re.search(r'\{[^{}]*"caption"[^{}]*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "caption": result.get("caption", ""),
                "hashtags": result.get("hashtags", "")
            }
    except json.JSONDecodeError:
        pass

    # Fallback: return raw text
    logger.warning(f"Could not parse JSON from Gemini response: {text[:200]}")
    return {
        "caption": text.strip(),
        "hashtags": ""
    }
