// _layout.tsx

import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="trash" 
        options={{
          headerShown: true,  // Show the header for the "note" screen
          title: '', // You can set a custom title for the note screen
          headerTransparent: true,

          headerBackTitle: 'trash',
          headerBackTitleStyle: {
            color: '#000',  // Set the back title color to black for iOS
          },
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTintColor: '#000',  // Ensures back icon and other header elements are also black
        }}
      />
      <Stack.Screen 
        name="note" 
        options={{
          headerShown: true,  // Show the header for the "note" screen
          title: '', // You can set a custom title for the note screen
          headerTransparent: true,

          headerBackTitle: 'bluu',
          headerBackTitleStyle: {
            color: '#000',  // Set the back title color to black for iOS
          },
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTintColor: '#000',  // Ensures back icon and other header elements are also black
        }}
      />
    </Stack>
  );
}
