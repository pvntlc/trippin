import React from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "./src/store/auth";
import { LoginScreen } from "./src/screens/LoginScreen";
import { TripsScreen } from "./src/screens/TripsScreen";
import { TripDetailScreen } from "./src/screens/TripDetailScreen";
import { Colors } from "./src/constants/colors";

export type RootStackParamList = {
  Trips: undefined;
  TripDetail: { tripId: number; title?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
});

// 브라우저 뒤로가기가 인앱 스택을 pop 하도록 URL ↔ 화면 연결.
// (없으면 웹에서 뒤로가기 시 앱을 벗어나 '꺼지는' 것처럼 보임)
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: Platform.OS === "web" && typeof window !== "undefined" ? [window.location.origin] : [],
  config: {
    screens: {
      Trips: "",
      TripDetail: { path: "trip/:tripId", parse: { tripId: Number } },
    },
  },
};

function Root() {
  const { token, loading, markActivity } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!token) return <LoginScreen />;

  return (
    <NavigationContainer linking={linking} onStateChange={markActivity}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bgCard },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="Trips" component={TripsScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="TripDetail"
          component={TripDetailScreen}
          options={({ route }) => ({ title: route.params.title ?? "여행" })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Root />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
