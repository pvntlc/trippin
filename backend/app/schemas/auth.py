from pydantic import BaseModel, EmailStr, Field


class KakaoLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=512)
    redirect_uri: str = Field(min_length=1, max_length=512)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str

    class Config:
        from_attributes = True
