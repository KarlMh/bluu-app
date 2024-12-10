// tash.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Svg, Path } from 'react-native-svg';

export default function Trash() {
  const [trash, setTrash] = useState([]);
  const router = useRouter();

  const resetAsyncStorage = async () => {
    try {
      await AsyncStorage.clear();
      console.log('AsyncStorage has been successfully cleared.');
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
    }
  };

  // Function to load trash from AsyncStorage
  const loadTrash = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const trashIds = keys.filter((key) => key.startsWith('trash_'));
      const savedTrash = await Promise.all(
        trashIds.map(async (key) => {
          const noteId = key.split('_')[1];
          const noteContent = await AsyncStorage.getItem(key);
          const noteTitle = await AsyncStorage.getItem(`trash_title_${noteId}`);
          const noteDate = await AsyncStorage.getItem(`trash_date_${noteId}`);
          return { id: noteId, title: noteTitle || 'Untitled', content: noteContent || '', date: noteDate || new Date().toISOString() };
        })
      );
      setTrash(savedTrash);
    } catch (error) {
      console.error('Error loading trash:', error);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  // Restore a note from trash
  const restoreNote = async (id) => {
    try {
      const noteContent = await AsyncStorage.getItem(`trash_${id}`);
      const noteTitle = await AsyncStorage.getItem(`trash_title_${id}`);
      const noteDate = await AsyncStorage.getItem(`trash_date_${id}`);

      if (noteContent !== null || noteTitle !== null || noteDate !== null) {
        await AsyncStorage.setItem(`note_${id}`, noteContent || '');
        await AsyncStorage.setItem(`title_${id}`, noteTitle || '');
        await AsyncStorage.setItem(`date_${id}`, noteDate || new Date().toISOString());
      }

      await AsyncStorage.removeItem(`trash_${id}`);
      await AsyncStorage.removeItem(`trash_title_${id}`);
      await AsyncStorage.removeItem(`trash_date_${id}`);

      setTrash((prevTrash) => prevTrash.filter((note) => note.id !== id));
    } catch (error) {
      console.error('Error restoring note:', error);
      Alert.alert('Error', 'Unable to restore the note.');
    }
  };

  // Permanently delete a note from trash
  const permanentlyDeleteNote = async (id) => {
    try {
      await AsyncStorage.removeItem(`trash_${id}`);
      await AsyncStorage.removeItem(`trash_title_${id}`);
      await AsyncStorage.removeItem(`trash_date_${id}`);
      setTrash((prevTrash) => prevTrash.filter((note) => note.id !== id));
    } catch (error) {
      console.error('Error permanently deleting note:', error);
      Alert.alert('Error', 'Unable to permanently delete the note.');
    }
  };

  const deleteAllTrash = async () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to delete all? This action cannot be undone.');
      if (confirm) {
        try {
          const keys = await AsyncStorage.getAllKeys();
          const trashKeys = keys.filter(
            (key) =>
              key.startsWith('trash_') ||
              key.startsWith('trash_title_') ||
              key.startsWith('trash_date_')
          );
          await Promise.all(trashKeys.map((key) => AsyncStorage.removeItem(key)));
          setTrash([]);
        } catch (error) {
          console.error('Error deleting all trash:', error);
        }
      }
    } else {
      Alert.alert(
        'Confirm Delete All',
        'This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete All',
            style: 'destructive',
            onPress: async () => {
              try {
                const keys = await AsyncStorage.getAllKeys();
                const trashKeys = keys.filter(
                  (key) =>
                    key.startsWith('trash_') ||
                    key.startsWith('trash_title_') ||
                    key.startsWith('trash_date_')
                );
                await Promise.all(trashKeys.map((key) => AsyncStorage.removeItem(key)));
                setTrash([]);
              } catch (error) {
                console.error('Error deleting all trash:', error);
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };
  

  function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `last edited: ${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Trash</Text>
      {trash.length === 0 ? (
        <View style={styles.fillBox}>
          <Text style={styles.emptyMessage}>Trash is empty...</Text>
        </View>
      ) : (
        <FlatList
          data={trash}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemContainer}>
              <View style={styles.noteItem}>
                <Text style={styles.noteText}>{item.title}</Text>
                <Text style={styles.noteDate}>{formatTimestamp(item.date)}</Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={() => restoreNote(item.id)}
                  style={styles.minimalButton}
                >
                  <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <Path fill="black" d="M19 13H5v-2h14v2z" />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => permanentlyDeleteNote(item.id)}
                  style={styles.minimalButton}
                >
                  <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <Path fill="black" d="M3 6h18v2H3V6zm2 3h14l-1.5 13H6.5L5 9zm4 2v8h2v-8H9zm4 0v8h2v-8h-2z" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
        {trash.length !== 0 && (
        <TouchableOpacity onPress={deleteAllTrash} style={styles.deleteAllButton}>
            <Text style={styles.deleteAllText}>Delete All</Text>
        </TouchableOpacity>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 75,
  },
  fillBox: {
    flex: 1,
    justifyContent: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  noteItem: {
    flex: 1,
  },
  noteText: {
    color: '#3e3e3e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noteDate: {
    color: '#808080',
    fontSize: 12,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  minimalButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    marginHorizontal: 5,
  },
  emptyMessage: {
    color: '#808080',
    fontSize: 16,
    textAlign: 'center',
  },
  deleteAllButton: {
    flexDirection: 'row',
    padding: 10,
    marginVertical: 20,
    borderRadius: 5,
    alignItems: 'center',
  },
  deleteAllText: {
    fontSize: 16,
  },
});
