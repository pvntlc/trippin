from pydantic import BaseModel, EmailStr, Field


class KakaoLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=512)
    redirect_uri: str = Field(min_length=1, max_length=512)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new: bool = False   # 이번 로그인에서 계정이 새로 생성됐는지(닉네임 설정 유도용)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    # 닉네임 변경
    name: str | None = Field(default=None, min_length=1, max_length=100)
