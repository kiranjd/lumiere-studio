"""Content pipeline orchestrator - runs as background tasks"""

import asyncio
import logging
from datetime import datetime
from typing import Optional
import os

from .airtable_client import AirtableClient, ContentRecord

logger = logging.getLogger(__name__)


class ContentOrchestrator:
    """
    Orchestrates the content pipeline:
    1. Process "Idea" records - generate images
    2. Process "Approved" records - schedule to social media (TODO: add scheduler)
    """

    def __init__(self):
        self._airtable: Optional[AirtableClient] = None
        self._running = False

    @property
    def airtable(self) -> AirtableClient:
        """Lazy init Airtable client"""
        if self._airtable is None:
            self._airtable = AirtableClient()
        return self._airtable

    def get_public_url(self, filename: str) -> str:
        """Get public URL for an image file"""
        public_base = os.environ.get("PUBLIC_URL", "http://localhost:8000")
        return f"{public_base}/beta/{filename}"

    async def process_pending_generations(self):
        """Process all 'Idea' status records through generation"""
        if self._running:
            logger.warning("Generation job already running, skipping")
            return

        self._running = True
        try:
            records = self.airtable.get_pending_generations()
            logger.info(f"Found {len(records)} records pending generation")

            for record in records:
                await self._process_generation(record)

        except Exception as e:
            logger.error(f"Generation processing failed: {e}")
        finally:
            self._running = False

    async def _process_generation(self, record: ContentRecord):
        """Process a single record through generation"""
        from ..generation_service import generate_image

        try:
            # Update status to Generating
            self.airtable.update_status(record.id, "Generating")
            logger.info(f"Generating image for record {record.id}: {record.title}")

            # Generate image
            result = await generate_image(
                prompt=record.prompt,
                model=record.model,
                refs=record.reference_images,
                aspect=record.aspect_ratio,
                quality=record.quality
            )

            # Construct public URL
            image_url = self.get_public_url(result["filename"])

            # Update Airtable with image
            self.airtable.set_image(
                record.id,
                image_url=image_url,
                local_path=result["path"]
            )

            logger.info(f"Generated image for record {record.id}: {result['filename']}")

        except Exception as e:
            logger.error(f"Generation failed for {record.id}: {e}")
            self.airtable.set_error(record.id, str(e))

    async def schedule_approved_posts(self):
        """
        Schedule approved posts to social media.

        TODO: Implement when a reliable scheduler API is chosen.
        Candidates: Late (getlate.dev), Ayrshare, or direct platform APIs.
        """
        logger.debug("Scheduler not configured - manual posting required")
        return

    async def get_pipeline_status(self) -> dict:
        """Get current status of the content pipeline"""
        status_counts = self.airtable.get_status_counts()

        return {
            "status_counts": status_counts,
            "total": sum(status_counts.values()),
            "scheduler_connected": False,  # TODO: update when scheduler is added
            "scheduler_running": not self._running
        }


# Global orchestrator instance
_orchestrator: Optional[ContentOrchestrator] = None


def get_orchestrator() -> ContentOrchestrator:
    """Get or create global orchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ContentOrchestrator()
    return _orchestrator
