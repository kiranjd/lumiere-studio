// Enhanced Image Assessment API using Gemini Flash

import { getImageUrl, imageToBase64 } from './server';
import type { Assessment } from '../types';

const OR_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const QA_MODEL = 'google/gemini-3-flash-preview';

const ASSESSMENT_PROMPT = `You are an expert image analyst specializing in AI-generated character imagery. Your job is to provide comprehensive feedback that helps iteratively improve images to publication quality for social media (Instagram, Twitter, professional portfolios).

## Assessment Dimensions

### 1. Technical Quality (Realism Score)
- **Skin & Texture**: Pores, fine hairs, natural imperfections vs plastic/airbrushed look
- **Anatomical Accuracy**: Correct limb proportions, finger count, joint positions, eye alignment
- **Lighting Consistency**: Shadows match light sources, no artificial halos
- **Camera Authenticity**: Natural depth of field, lens artifacts, appropriate grain

### 2. Character Consistency (if references provided)
- **Facial Structure**: Same face shape, nose, lips, eye spacing
- **Distinctive Features**: Moles, skin tone, hair texture preserved
- **Expression Authenticity**: Natural to the character's personality
- **Overall "Same Person" Energy**: Would viewers recognize this as the same character?

### 3. Social Media Readiness
- **Composition**: Rule of thirds, focal point, visual balance
- **Emotional Impact**: Does it evoke feeling? Tell a story?
- **Engagement Potential**: Would this stop someone scrolling?
- **Caption-worthiness**: Does it inspire a narrative?

### 4. Creative Enhancement Opportunities
- Think beyond fixes - what would make this image extraordinary?
- Consider: dramatic lighting, unique angles, environmental storytelling, fashion choices

## Response Format
Respond with ONLY a valid JSON object (no markdown, no code blocks):

{
  "scores": {
    "realism": <1-10>,
    "consistency": <1-10 or null if no refs>,
    "socialReady": <1-10>,
    "overall": <1-10>
  },
  "verdict": "<one-word: 'reject'|'iterate'|'good'|'excellent'>",
  "headline": "<string: 8-12 word summary of the image's strength or main issue>",
  "technical": {
    "strengths": ["<specific strength>", "<another>"],
    "issues": ["<specific issue with location, e.g. 'left hand has 6 fingers'>"]
  },
  "consistency": {
    "match": <0-100 percentage or null>,
    "preserved": ["<what matches the reference>"],
    "drifted": ["<what differs from reference>"]
  },
  "social": {
    "platform": "<best fit: 'instagram'|'twitter'|'linkedin'|'portfolio'>",
    "captionIdea": "<suggested caption/hook for this image>",
    "hashtags": ["<relevant>", "<tags>"]
  },
  "improvements": {
    "quickFixes": ["<prompt tweak that would help>"],
    "creativeSuggestions": ["<bold idea to elevate this>", "<another creative direction>"]
  },
  "iterationPrompt": "<ready-to-use prompt that incorporates the top fixes for a better version>"
}`;

interface AssessmentOptions {
  file: string;
  prompt?: string;
  referenceFiles?: string[];
}

export interface EnhancedAssessment extends Assessment {
  scores: {
    realism: number;
    consistency: number | null;
    socialReady: number;
    overall: number;
  };
  verdict: 'reject' | 'iterate' | 'good' | 'excellent';
  headline: string;
  technical: {
    strengths: string[];
    issues: string[];
  };
  consistency: {
    match: number | null;
    preserved: string[];
    drifted: string[];
  } | null;
  social: {
    platform: string;
    captionIdea: string;
    hashtags: string[];
  };
  improvements: {
    quickFixes: string[];
    creativeSuggestions: string[];
  };
  iterationPrompt: string;
}

export async function assessImage(file: string, prompt?: string): Promise<Assessment> {
  // Simple assessment without references
  const result = await assessImageEnhanced({ file, prompt });
  return result;
}

export async function assessImageEnhanced(options: AssessmentOptions): Promise<EnhancedAssessment> {
  const { file, prompt, referenceFiles = [] } = options;

  // Build message content
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  // Add reference images first (if any)
  if (referenceFiles.length > 0) {
    content.push({ type: 'text', text: `## Reference Images (${referenceFiles.length} golden examples of this character):\n` });
    for (const ref of referenceFiles) {
      const refUrl = getImageUrl(ref);
      const refData = await imageToBase64(refUrl);
      content.push({ type: 'image_url', image_url: { url: refData } });
    }
    content.push({ type: 'text', text: '\n## Image to Assess:\n' });
  }

  // Add the main image
  const imgUrl = getImageUrl(file);
  const imgData = await imageToBase64(imgUrl);
  content.push({ type: 'image_url', image_url: { url: imgData } });

  // Add the prompt
  let fullPrompt = ASSESSMENT_PROMPT;
  if (prompt) {
    fullPrompt += `\n\n## Original Generation Prompt\n"${prompt}"`;
  }
  if (referenceFiles.length > 0) {
    fullPrompt += `\n\n## Note\nCompare the assessed image against the ${referenceFiles.length} reference images to evaluate character consistency.`;
  } else {
    fullPrompt += `\n\n## Note\nNo reference images provided - set consistency scores to null.`;
  }
  content.push({ type: 'text', text: fullPrompt });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: QA_MODEL,
      messages: [{ role: 'user', content }]
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.choices?.[0]?.message?.content || '';
  return parseEnhancedAssessment(text);
}

function parseEnhancedAssessment(text: string): EnhancedAssessment {
  try {
    // Extract JSON from response
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonStr = objectMatch[0];

    const parsed = JSON.parse(jsonStr);

    // Build the enhanced assessment
    const scores = {
      realism: clamp(parsed.scores?.realism || 5),
      consistency: parsed.scores?.consistency != null ? clamp(parsed.scores.consistency) : null,
      socialReady: clamp(parsed.scores?.socialReady || 5),
      overall: clamp(parsed.scores?.overall || 5),
    };

    return {
      // Legacy fields for backwards compatibility
      score: scores.overall,
      strengths: parsed.technical?.strengths || [],
      weaknesses: parsed.technical?.issues || [],
      fixes: parsed.improvements?.quickFixes || [],
      timestamp: Date.now(),

      // Enhanced fields
      scores,
      verdict: parsed.verdict || 'iterate',
      headline: parsed.headline || 'Assessment complete',
      technical: {
        strengths: parsed.technical?.strengths || [],
        issues: parsed.technical?.issues || [],
      },
      consistency: parsed.consistency?.match != null ? {
        match: parsed.consistency.match,
        preserved: parsed.consistency.preserved || [],
        drifted: parsed.consistency.drifted || [],
      } : null,
      social: {
        platform: parsed.social?.platform || 'instagram',
        captionIdea: parsed.social?.captionIdea || '',
        hashtags: parsed.social?.hashtags || [],
      },
      improvements: {
        quickFixes: parsed.improvements?.quickFixes || [],
        creativeSuggestions: parsed.improvements?.creativeSuggestions || [],
      },
      iterationPrompt: parsed.iterationPrompt || '',
    };
  } catch (e) {
    console.error('Enhanced assessment parse failed:', e, text);

    // Return fallback
    return {
      score: 5,
      strengths: ['Unable to parse response'],
      weaknesses: ['Parse error'],
      fixes: ['Try assessing again'],
      timestamp: Date.now(),
      scores: { realism: 5, consistency: null, socialReady: 5, overall: 5 },
      verdict: 'iterate',
      headline: 'Assessment parse error',
      technical: { strengths: [], issues: ['Parse error - check console'] },
      consistency: null,
      social: { platform: 'instagram', captionIdea: '', hashtags: [] },
      improvements: { quickFixes: ['Try again'], creativeSuggestions: [] },
      iterationPrompt: '',
    };
  }
}

function clamp(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n)));
}
