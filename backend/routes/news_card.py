from fastapi import APIRouter, Request
from database_connetion import get_db

router = APIRouter()


@router.get("news_card/{source}/{url}",response_model="")
async def news_card(url:str,source:str):
    return