"""Airtable integration for content calendar management"""

from pyairtable import Api
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)


class ContentRecord(BaseModel):
    """Content record from Airtable Content Calendar"""
    id: str
    title: str
    prompt: str
    status: str
    platforms: List[str]
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    image_url: Optional[str] = None
    local_image_path: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    postiz_post_id: Optional[str] = None
    model: str = "Gemini 3"
    aspect_ratio: str = "1:1"
    quality: str = "medium"
    reference_images: List[str] = []
    error: Optional[str] = None


class AirtableClient:
    """Client for Airtable Content Calendar operations"""

    def __init__(self):
        pat = os.environ.get("AIRTABLE_PAT")
        base_id = os.environ.get("AIRTABLE_BASE_ID")

        if not pat or not base_id:
            raise ValueError("AIRTABLE_PAT and AIRTABLE_BASE_ID must be set")

        self.api = Api(pat)
        self.table = self.api.table(base_id, "Content Calendar")

    def get_pending_generations(self) -> List[ContentRecord]:
        """Fetch records with Status = 'Idea' ready for generation"""
        try:
            records = self.table.all(
                formula="{Status} = 'Idea'",
                sort=["ScheduledDate"]
            )
            return [self._to_content_record(r) for r in records]
        except Exception as e:
            logger.error(f"Failed to fetch pending generations: {e}")
            return []

    def get_approved_for_scheduling(self) -> List[ContentRecord]:
        """Fetch records approved and ready to schedule"""
        try:
            records = self.table.all(
                formula="{Status} = 'Approved'"
            )
            return [self._to_content_record(r) for r in records]
        except Exception as e:
            logger.error(f"Failed to fetch approved records: {e}")
            return []

    def get_review_pending(self) -> List[ContentRecord]:
        """Fetch records pending review"""
        try:
            records = self.table.all(
                formula="{Status} = 'Review'"
            )
            return [self._to_content_record(r) for r in records]
        except Exception as e:
            logger.error(f"Failed to fetch review pending: {e}")
            return []

    def update_status(self, record_id: str, status: str, **kwargs):
        """Update record status and optional fields"""
        fields = {"Status": status}

        # Map Python field names to Airtable field names
        field_mapping = {
            "postiz_post_id": "PostizPostId",
            "published_at": "PublishedAt",
            "image_url": "ImageURL",
            "local_image_path": "LocalImagePath",
            "error": "Error",
        }

        for key, value in kwargs.items():
            airtable_key = field_mapping.get(key, key)
            fields[airtable_key] = value

        try:
            self.table.update(record_id, fields)
            logger.info(f"Updated record {record_id} to status {status}")
        except Exception as e:
            logger.error(f"Failed to update record {record_id}: {e}")
            raise

    def set_image(self, record_id: str, image_url: str, local_path: str):
        """Set generated image URL and path, move to Review status"""
        self.table.update(record_id, {
            "ImageURL": image_url,
            "LocalImagePath": local_path,
            "Status": "Review"
        })
        logger.info(f"Set image for record {record_id}")

    def set_error(self, record_id: str, error: str):
        """Mark record as failed with error message"""
        self.table.update(record_id, {
            "Status": "Failed",
            "Error": error
        })
        logger.error(f"Record {record_id} failed: {error}")

    def update_post_content(
        self,
        record_id: str,
        caption: Optional[str] = None,
        hashtags: Optional[str] = None,
        platforms: Optional[List[str]] = None,
        scheduled_date: Optional[str] = None,
        status: Optional[str] = None,
    ):
        """Update post content fields"""
        fields = {}
        if caption is not None:
            fields["Caption"] = caption
        if hashtags is not None:
            fields["Hashtags"] = hashtags
        if platforms is not None:
            fields["Platforms"] = platforms
        if scheduled_date is not None:
            fields["ScheduledDate"] = scheduled_date
        if status is not None:
            fields["Status"] = status

        if fields:
            self.table.update(record_id, fields)
            logger.info(f"Updated post content for {record_id}")

    def delete_record(self, record_id: str):
        """Delete a record"""
        self.table.delete(record_id)
        logger.info(f"Deleted record {record_id}")

    def create_record(
        self,
        title: str,
        image_url: str,
        local_path: str,
        platforms: List[str],
        caption: Optional[str] = None,
        hashtags: Optional[str] = None,
        scheduled_date: Optional[str] = None,
    ) -> str:
        """Create a new record with an existing image (skip generation)"""
        fields = {
            "Title": title,
            "Prompt": "",  # Already generated
            "Status": "Review",
            "Platforms": platforms,
            "ImageURL": image_url,
            "LocalImagePath": local_path,
        }

        if caption:
            fields["Caption"] = caption
        if hashtags:
            fields["Hashtags"] = hashtags
        if scheduled_date:
            fields["ScheduledDate"] = scheduled_date

        try:
            record = self.table.create(fields)
            logger.info(f"Created record {record['id']}")
            return record["id"]
        except Exception as e:
            logger.error(f"Failed to create record: {e}")
            raise

    def get_posts_for_publishing(self) -> List[dict]:
        """Get all posts for the publishing dashboard (Review, Approved, Scheduled, Published)"""
        try:
            records = self.table.all(
                formula="OR({Status} = 'Review', {Status} = 'Approved', {Status} = 'Scheduled', {Status} = 'Published')",
                sort=["-ScheduledDate"]
            )
            posts = []
            for record in records:
                fields = record["fields"]
                posts.append({
                    "id": record["id"],
                    "title": fields.get("Title", "Untitled"),
                    "imageUrl": fields.get("ImageURL", ""),
                    "localPath": fields.get("LocalImagePath"),
                    "caption": fields.get("Caption", ""),
                    "hashtags": fields.get("Hashtags", ""),
                    "platforms": fields.get("Platforms", []),
                    "scheduledDate": fields.get("ScheduledDate"),
                    "status": fields.get("Status", "Review"),
                    "createdAt": record.get("createdTime", ""),
                })
            return posts
        except Exception as e:
            logger.error(f"Failed to fetch posts for publishing: {e}")
            return []

    def get_status_counts(self) -> dict:
        """Get count of records by status"""
        try:
            all_records = self.table.all()
            counts = {}
            for record in all_records:
                status = record["fields"].get("Status", "Unknown")
                counts[status] = counts.get(status, 0) + 1
            return counts
        except Exception as e:
            logger.error(f"Failed to get status counts: {e}")
            return {}

    def _to_content_record(self, record: dict) -> ContentRecord:
        """Convert Airtable record to ContentRecord model"""
        fields = record["fields"]

        # Parse scheduled date if present
        scheduled_date = None
        if fields.get("ScheduledDate"):
            try:
                scheduled_date = datetime.fromisoformat(
                    fields["ScheduledDate"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        # Extract reference image URLs from attachments
        ref_images = []
        if fields.get("ReferenceImages"):
            ref_images = [a.get("url", "") for a in fields["ReferenceImages"] if a.get("url")]

        return ContentRecord(
            id=record["id"],
            title=fields.get("Title", ""),
            prompt=fields.get("Prompt", ""),
            status=fields.get("Status", "Idea"),
            platforms=fields.get("Platforms", []),
            caption=fields.get("Caption"),
            hashtags=fields.get("Hashtags"),
            image_url=fields.get("ImageURL"),
            local_image_path=fields.get("LocalImagePath"),
            scheduled_date=scheduled_date,
            postiz_post_id=fields.get("PostizPostId"),
            model=fields.get("Model", "Gemini 3"),
            aspect_ratio=fields.get("AspectRatio", "1:1"),
            quality=fields.get("Quality", "medium"),
            reference_images=ref_images,
            error=fields.get("Error"),
        )
