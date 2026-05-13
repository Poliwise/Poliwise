from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..dependencies import get_user_context, UserContext

router = APIRouter(prefix="/models", tags=["Models"])


class AIModelResponse(BaseModel):
    id: str
    name: str
    provider: str
    description: str | None
    is_default: bool


class ModelListResponse(BaseModel):
    models: list[AIModelResponse]


@router.get("", response_model=ModelListResponse)
async def list_models(user: UserContext = Depends(get_user_context)):
    from ...services.generation.llm_client import model_registry

    profiles = model_registry.list_models()

    models = []
    for profile in profiles:
        models.append(AIModelResponse(
            id=profile.id,
            name=profile.name,
            provider=profile.provider,
            description=f"{profile.name} via {profile.base_url}",
            is_default=profile.is_default
        ))

    if not any(m.is_default for m in models):
        models[0].is_default = True

    return ModelListResponse(models=models)