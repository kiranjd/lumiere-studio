"""
Lumière Studio - FastAPI Backend
Serves image assets and handles generation save/list operations
With Airtable integration for content planning
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pathlib import Path
import json
import base64
import re
import os
import logging
from datetime import datetime
from typing import Optional, List

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
BETA_DIR = BASE_DIR / "beta"
TO_BE_PROCESSED_DIR = BETA_DIR / "to-be-processed"
GENERATED_DIR = BETA_DIR / "generated"
SPECIFIC_DIR = BETA_DIR / "specific"
ARCHIVE_DIR = BETA_DIR / "archive"
MANIFEST_PATH = BETA_DIR / "manifest.json"
BATCHES_PATH = BETA_DIR / "batches.json"
INCOGNITO_PATH = BETA_DIR / "incognito.json"

# Ensure directories exist
TO_BE_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
GENERATED_DIR.mkdir(parents=True, exist_ok=True)
ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

# ============ Background Scheduler Setup ============

# Scheduler state
scheduler = None
SCHEDULER_ENABLED = os.environ.get("SCHEDULER_ENABLED", "true").lower() == "true"


async def run_generation_job():
    """Background job to process pending generations"""
    from integrations.orchestrator import get_orchestrator
    try:
        orchestrator = get_orchestrator()
        await orchestrator.process_pending_generations()
    except Exception as e:
        logger.error(f"Generation job failed: {e}")


async def run_scheduling_job():
    """Background job to schedule approved posts - disabled until scheduler is configured"""
    pass  # Using Buffer manually for now


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - start/stop background scheduler"""
    global scheduler

    if SCHEDULER_ENABLED:
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from apscheduler.triggers.interval import IntervalTrigger

            scheduler = AsyncIOScheduler()

            # Add generation job - every 5 minutes
            scheduler.add_job(
                run_generation_job,
                IntervalTrigger(minutes=5),
                id="generation_job",
                replace_existing=True,
                max_instances=1
            )
            # Note: Scheduling job disabled - using Buffer manually

            scheduler.start()
            logger.info("Background scheduler started")
        except ImportError:
            logger.warning("APScheduler not installed - background jobs disabled")
        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown()
        logger.info("Background scheduler stopped")


app = FastAPI(
    title="Lumière Studio API",
    description="Backend for AI image generation studio with social media pipeline",
    version="2.1.0",
    lifespan=lifespan
)

# CORS - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Models ============

class SaveImageRequest(BaseModel):
    image: str  # base64 or data URL
    prompt: str
    model: str
    refs: List[str] = []  # reference images used
    aspect: str = "1:1"
    quality: str = "medium"
    character: str = "beta"


class SaveGridImageRequest(BaseModel):
    image: str  # base64 or data URL
    base_filename: str  # original filename without extension
    index: int  # cell index (1, 2, 3...)


class GeneratedImage(BaseModel):
    file: str
    tags: List[str] = ["generated", "new"]
    prompt: Optional[str] = None
    model: Optional[str] = None
    refs: List[str] = []
    aspect: Optional[str] = None
    quality: Optional[str] = None
    createdAt: Optional[str] = None


class LibraryImage(BaseModel):
    file: str
    tags: List[str] = []
    model: Optional[str] = None
    prompt: Optional[str] = None


class BatchImage(BaseModel):
    file: str
    addedAt: int


class Batch(BaseModel):
    id: str
    name: str
    color: str
    images: List[BatchImage] = []
    createdAt: int


class BatchSyncRequest(BaseModel):
    batches: List[Batch]


# ============ API Routes ============

@app.get("/api/images/generated", response_model=List[GeneratedImage])
async def list_generated_images():
    """List all images in the to-be-processed folder with metadata"""
    images = []

    if TO_BE_PROCESSED_DIR.exists():
        for f in sorted(TO_BE_PROCESSED_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.suffix.lower() == '.png':
                # Try to load metadata from sidecar JSON
                metadata_path = f.with_suffix('.json')
                metadata = {}
                if metadata_path.exists():
                    try:
                        metadata = json.loads(metadata_path.read_text())
                    except Exception:
                        pass

                images.append(GeneratedImage(
                    file=f"to-be-processed/{f.name}",
                    tags=["generated", "new"],
                    prompt=metadata.get("prompt"),
                    model=metadata.get("model"),
                    refs=metadata.get("refs", []),
                    aspect=metadata.get("aspect"),
                    quality=metadata.get("quality"),
                    createdAt=metadata.get("createdAt"),
                ))

    return images


@app.post("/api/images/save")
async def save_image(request: SaveImageRequest):
    """Save a generated image to the to-be-processed folder with metadata"""
    try:
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        timestamp_iso = datetime.now().isoformat()

        # Clean prompt for filename (first 30 chars)
        # Replace all whitespace (including newlines) with spaces first, then clean
        clean_prompt = re.sub(r'\s+', ' ', request.prompt)  # Collapse all whitespace to single space
        clean_prompt = re.sub(r'[^a-zA-Z0-9 ]', '', clean_prompt)[:30]
        clean_prompt = clean_prompt.strip().replace(' ', '-').lower()

        # Get model short name
        model_short = request.model.split('/')[-1].split('-')[0]

        filename = f"{timestamp}_{model_short}_{clean_prompt}.png"
        filepath = TO_BE_PROCESSED_DIR / filename

        # Handle base64 data URL or raw base64
        image_data = request.image
        if image_data.startswith('data:'):
            image_data = image_data.split(',')[1]

        # Decode and save image
        image_bytes = base64.b64decode(image_data)
        filepath.write_bytes(image_bytes)

        # Save metadata sidecar JSON
        metadata = {
            "prompt": request.prompt,
            "model": request.model,
            "refs": request.refs,
            "aspect": request.aspect,
            "quality": request.quality,
            "createdAt": timestamp_iso,
        }
        metadata_path = filepath.with_suffix('.json')
        metadata_path.write_text(json.dumps(metadata, indent=2))

        return {
            "success": True,
            "filename": filename,
            "path": str(filepath)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/images/save-grid")
async def save_grid_image(request: SaveGridImageRequest):
    """Save a grid-cropped image with custom filename"""
    try:
        # Generate filename based on original + index
        filename = f"{request.base_filename}_{request.index}.png"
        filepath = TO_BE_PROCESSED_DIR / filename

        # Handle filename collisions
        counter = 1
        while filepath.exists():
            filename = f"{request.base_filename}_{request.index}_{counter}.png"
            filepath = TO_BE_PROCESSED_DIR / filename
            counter += 1

        # Handle base64 data URL or raw base64
        image_data = request.image
        if image_data.startswith('data:'):
            image_data = image_data.split(',')[1]

        # Decode and save
        image_bytes = base64.b64decode(image_data)
        filepath.write_bytes(image_bytes)

        return {
            "success": True,
            "filename": filename,
            "path": str(filepath)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TagUpdateRequest(BaseModel):
    file: str
    tag: str
    action: str = "add"  # "add" or "remove"


@app.post("/api/images/tag")
async def update_image_tag(request: TagUpdateRequest):
    """Add or remove a tag from an image in the manifest"""
    try:
        if not MANIFEST_PATH.exists():
            raise HTTPException(status_code=404, detail="Manifest not found")

        data = json.loads(MANIFEST_PATH.read_text())

        # Find the image in manifest
        found = False
        for item in data:
            if item.get("file") == request.file:
                found = True
                tags = item.get("tags", [])
                if request.action == "add" and request.tag not in tags:
                    tags.append(request.tag)
                elif request.action == "remove" and request.tag in tags:
                    tags.remove(request.tag)
                item["tags"] = tags
                break

        # If not in manifest, add it
        if not found:
            data.append({
                "file": request.file,
                "tags": [request.tag] if request.action == "add" else []
            })

        # Save manifest
        MANIFEST_PATH.write_text(json.dumps(data, indent=2))

        return {"success": True, "file": request.file, "tag": request.tag, "action": request.action}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/images/library", response_model=List[LibraryImage])
async def get_library():
    """Get the manifest.json library of reference images + specific folder + beta root images"""
    images = []
    seen_files = set()

    # Load from manifest
    if MANIFEST_PATH.exists():
        try:
            data = json.loads(MANIFEST_PATH.read_text())
            for item in data:
                images.append(LibraryImage(**item))
                seen_files.add(item.get("file", ""))
        except Exception as e:
            print(f"Warning: Failed to load manifest: {e}")

    # Add images from specific folder (expressions)
    if SPECIFIC_DIR.exists():
        for f in sorted(SPECIFIC_DIR.iterdir()):
            if f.suffix.lower() in ('.png', '.jpg', '.jpeg'):
                file_path = f"specific/{f.name}"
                if file_path not in seen_files:
                    # Extract expression from filename like "01-happy.png"
                    name = f.stem
                    parts = name.split('-')
                    expression = parts[1] if len(parts) > 1 else name
                    images.append(LibraryImage(
                        file=file_path,
                        tags=["specific", "expression", expression]
                    ))
                    seen_files.add(file_path)

    # Add images from beta root folder (not in subfolders, not in manifest)
    # This catches files synced via iCloud like IMG_*.PNG
    if BETA_DIR.exists():
        for f in sorted(BETA_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.is_file() and f.suffix.lower() in ('.png', '.jpg', '.jpeg'):
                if f.name not in seen_files:
                    # Determine tags based on filename pattern
                    tags = ["library"]
                    if f.name.startswith("IMG_"):
                        tags.append("ipad")
                    elif f.name.startswith("2025"):
                        tags.append("generated")
                    images.append(LibraryImage(
                        file=f.name,
                        tags=tags
                    ))
                    seen_files.add(f.name)

    return images


@app.delete("/api/images/{file_path:path}")
async def delete_image(file_path: str):
    """Move an image file to archive instead of deleting"""
    try:
        # Resolve the full path within BETA_DIR
        full_path = BETA_DIR / file_path

        # Security: ensure the path is within BETA_DIR
        full_path = full_path.resolve()
        if not str(full_path).startswith(str(BETA_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        if not full_path.is_file():
            raise HTTPException(status_code=400, detail="Not a file")

        # Move to archive instead of deleting
        archive_path = ARCHIVE_DIR / full_path.name
        # Handle filename collisions
        if archive_path.exists():
            timestamp = datetime.now().strftime('%H%M%S')
            archive_path = ARCHIVE_DIR / f"{full_path.stem}_{timestamp}{full_path.suffix}"

        import shutil
        shutil.move(str(full_path), str(archive_path))

        return {"success": True, "archived": file_path, "archive_path": f"archive/{archive_path.name}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/images/archive", response_model=List[GeneratedImage])
async def list_archived_images():
    """List all images in the archive folder"""
    images = []

    if ARCHIVE_DIR.exists():
        for f in sorted(ARCHIVE_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.suffix.lower() in ('.png', '.jpg', '.jpeg'):
                images.append(GeneratedImage(
                    file=f"archive/{f.name}",
                    tags=["archived"]
                ))

    return images


@app.post("/api/images/restore/{file_name}")
async def restore_image(file_name: str):
    """Restore an image from archive back to to-be-processed"""
    try:
        archive_path = ARCHIVE_DIR / file_name

        if not archive_path.exists():
            raise HTTPException(status_code=404, detail="File not found in archive")

        # Move back to to-be-processed
        restore_path = TO_BE_PROCESSED_DIR / file_name
        # Handle filename collisions
        if restore_path.exists():
            timestamp = datetime.now().strftime('%H%M%S')
            restore_path = TO_BE_PROCESSED_DIR / f"{archive_path.stem}_{timestamp}{archive_path.suffix}"

        import shutil
        shutil.move(str(archive_path), str(restore_path))

        return {"success": True, "restored": f"to-be-processed/{restore_path.name}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/images/archive/{file_name}")
async def permanently_delete_image(file_name: str):
    """Permanently delete an image from archive"""
    try:
        archive_path = ARCHIVE_DIR / file_name

        if not archive_path.exists():
            raise HTTPException(status_code=404, detail="File not found in archive")

        archive_path.unlink()
        return {"success": True, "deleted": file_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "2.1.0",
        "scheduler_enabled": SCHEDULER_ENABLED,
        "scheduler_running": scheduler is not None and scheduler.running if scheduler else False
    }


# ============ Batch Sync ============

@app.get("/api/batches", response_model=List[Batch])
async def get_batches():
    """Get all batches from server storage"""
    if BATCHES_PATH.exists():
        try:
            data = json.loads(BATCHES_PATH.read_text())
            return [Batch(**batch) for batch in data]
        except Exception as e:
            print(f"Warning: Failed to load batches: {e}")
            return []
    return []


@app.post("/api/batches/sync")
async def sync_batches(request: BatchSyncRequest):
    """Sync batches - merges client batches with server batches by ID"""
    try:
        # Load existing server batches
        server_batches = {}
        if BATCHES_PATH.exists():
            try:
                data = json.loads(BATCHES_PATH.read_text())
                server_batches = {b["id"]: b for b in data}
            except Exception:
                pass

        # Merge: client batches take precedence, but we keep server-only batches
        client_batches = {b.id: b.model_dump() for b in request.batches}

        # Start with server batches, then update/add client batches
        merged = {**server_batches, **client_batches}

        # Convert to list and sort by createdAt
        result = sorted(merged.values(), key=lambda x: x["createdAt"])

        # Save to file
        BATCHES_PATH.write_text(json.dumps(result, indent=2))

        return {
            "success": True,
            "batches": result,
            "merged_count": len(result)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/batches")
async def save_batches(request: BatchSyncRequest):
    """Save batches (full replace)"""
    try:
        data = [b.model_dump() for b in request.batches]
        BATCHES_PATH.write_text(json.dumps(data, indent=2))
        return {"success": True, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Incognito Images ============

class IncognitoRequest(BaseModel):
    images: List[str]


@app.get("/api/incognito")
async def get_incognito_images():
    """Get list of incognito (hidden) images"""
    try:
        if INCOGNITO_PATH.exists():
            data = json.loads(INCOGNITO_PATH.read_text())
            return {"images": data.get("images", [])}
        return {"images": []}
    except Exception as e:
        logger.error(f"Failed to load incognito images: {e}")
        return {"images": []}


@app.put("/api/incognito")
async def save_incognito_images(request: IncognitoRequest):
    """Save incognito images list"""
    try:
        INCOGNITO_PATH.write_text(json.dumps({"images": request.images}, indent=2))
        return {"success": True, "count": len(request.images)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Social Media Pipeline ============

class SendToAirtableRequest(BaseModel):
    file: str
    title: str
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    platforms: List[str] = ["Instagram"]
    scheduled_date: Optional[str] = None


@app.post("/api/social/send-to-airtable")
async def send_to_airtable(request: SendToAirtableRequest):
    """Send an image from the library to Airtable for scheduling"""
    try:
        from integrations.airtable_client import AirtableClient

        airtable = AirtableClient()

        # Construct public URL
        public_base = os.environ.get("PUBLIC_URL", "http://localhost:8000")
        image_url = f"{public_base}/beta/{request.file}"
        local_path = str(BETA_DIR / request.file)

        # Create record in Airtable with Review status (skip generation)
        record_id = airtable.create_record(
            title=request.title,
            image_url=image_url,
            local_path=local_path,
            platforms=request.platforms,
            caption=request.caption,
            hashtags=request.hashtags,
            scheduled_date=request.scheduled_date,
        )

        return {"success": True, "record_id": record_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send to Airtable: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/social/channels")
async def get_social_channels():
    """Get connected social channels - placeholder until scheduler is configured"""
    return {"channels": [], "message": "No scheduler configured - use Buffer manually"}


@app.get("/api/social/pipeline-status")
async def get_pipeline_status():
    """Get current status of the content pipeline"""
    try:
        from integrations.orchestrator import get_orchestrator

        orchestrator = get_orchestrator()
        status = await orchestrator.get_pipeline_status()
        status["scheduler_enabled"] = SCHEDULER_ENABLED
        status["scheduler_running"] = scheduler is not None and scheduler.running if scheduler else False
        return status
    except ValueError as e:
        # Airtable not configured
        return {
            "status_counts": {},
            "total": 0,
            "scheduler_connected": False,
            "scheduler_enabled": SCHEDULER_ENABLED,
            "scheduler_running": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"Failed to get pipeline status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/social/trigger-generation")
async def trigger_generation():
    """Manually trigger generation processing"""
    try:
        from integrations.orchestrator import get_orchestrator

        orchestrator = get_orchestrator()
        await orchestrator.process_pending_generations()
        return {"success": True, "message": "Generation job completed"}
    except Exception as e:
        logger.error(f"Manual generation trigger failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/social/trigger-scheduling")
async def trigger_scheduling():
    """Placeholder - scheduling not configured"""
    return {"success": False, "message": "No scheduler configured - use Buffer manually"}


@app.get("/api/social/pending-posts")
async def get_pending_posts():
    """Get all posts pending review or ready to publish"""
    try:
        from integrations.airtable_client import AirtableClient

        airtable = AirtableClient()
        posts = airtable.get_posts_for_publishing()
        return {"posts": posts}
    except ValueError as e:
        # Airtable not configured
        return {"posts": [], "error": str(e)}
    except Exception as e:
        logger.error(f"Failed to get pending posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/social/mark-posted/{record_id}")
async def mark_as_posted(record_id: str):
    """Mark a post as published"""
    try:
        from integrations.airtable_client import AirtableClient

        airtable = AirtableClient()
        airtable.update_status(record_id, "Published")
        return {"success": True, "record_id": record_id}
    except Exception as e:
        logger.error(f"Failed to mark as posted: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdatePostRequest(BaseModel):
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    platforms: Optional[List[str]] = None
    scheduled_date: Optional[str] = None
    status: Optional[str] = None


@app.patch("/api/social/posts/{record_id}")
async def update_post(record_id: str, request: UpdatePostRequest):
    """Update a post's content (caption, hashtags, platforms, etc.)"""
    try:
        from integrations.airtable_client import AirtableClient

        airtable = AirtableClient()
        airtable.update_post_content(
            record_id,
            caption=request.caption,
            hashtags=request.hashtags,
            platforms=request.platforms,
            scheduled_date=request.scheduled_date,
            status=request.status,
        )
        return {"success": True, "record_id": record_id}
    except Exception as e:
        logger.error(f"Failed to update post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/social/posts/{record_id}")
async def delete_post(record_id: str):
    """Delete a post from the queue"""
    try:
        from integrations.airtable_client import AirtableClient

        airtable = AirtableClient()
        airtable.delete_record(record_id)
        return {"success": True, "record_id": record_id}
    except Exception as e:
        logger.error(f"Failed to delete post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class GenerateCaptionRequest(BaseModel):
    file: str
    platforms: List[str] = ["Instagram"]
    context: Optional[str] = None


# ============ Replicate Proxy (CORS workaround) ============

class ReplicateRequest(BaseModel):
    prompt: str
    width: int = 768
    height: int = 768
    num_inference_steps: int = 8  # 4=fast, 8=default, 16=quality


@app.post("/api/replicate/z-image-turbo")
async def replicate_z_image_turbo(request: ReplicateRequest):
    """Proxy to Replicate API for z-image-turbo model"""
    import httpx

    replicate_token = os.environ.get("REPLICATE_API_TOKEN")
    if not replicate_token:
        raise HTTPException(status_code=500, detail="REPLICATE_API_TOKEN not configured")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.replicate.com/v1/models/prunaai/z-image-turbo/predictions",
                headers={
                    "Authorization": f"Bearer {replicate_token}",
                    "Content-Type": "application/json",
                    "Prefer": "wait",
                },
                json={
                    "input": {
                        "prompt": request.prompt,
                        "width": request.width,
                        "height": request.height,
                        "num_inference_steps": request.num_inference_steps,
                        "output_format": "jpg",
                        "output_quality": 95,
                    }
                },
            )

            data = response.json()

            if response.status_code != 200 and response.status_code != 201:
                logger.error(f"Replicate API error: {data}")
                raise HTTPException(status_code=response.status_code, detail=data.get("error", "Replicate API error"))

            # Return the output URL(s)
            return {
                "output": data.get("output"),
                "status": data.get("status"),
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Replicate API timeout")
    except Exception as e:
        logger.error(f"Replicate proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/social/generate-caption")
async def generate_caption_endpoint(request: GenerateCaptionRequest):
    """Generate caption and hashtags for an image using Gemini"""
    try:
        from generation_service import generate_caption

        result = await generate_caption(
            image_path=request.file,
            platforms=request.platforms,
            context=request.context,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate caption: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Static Files ============

# Mount beta directory for serving images
app.mount("/beta", StaticFiles(directory=str(BETA_DIR)), name="beta")


# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    print(f"\n✦ Lumière Studio API")
    print(f"  Running at: http://localhost:8000")
    print(f"  API Docs:   http://localhost:8000/docs")
    print(f"  Serving:    {BETA_DIR}")
    print(f"\n  Press Ctrl+C to stop\n")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
