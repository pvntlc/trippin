/**
 * 토큰 영구 저장. 네이티브는 expo-secure-store, 웹은 localStorage 로 폴백.
 * (expo-secure-store 는 웹 미지원)
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
