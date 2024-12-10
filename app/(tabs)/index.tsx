// index.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, Animated, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SwipeListView } from 'react-native-swipe-list-view';
import { useFocusEffect } from '@react-navigation/native';
import { Svg, Path } from 'react-native-svg';
import { VscPinned } from "react-icons/vsc";
import { EventRegister } from 'react-native-event-listeners'
import Markdown from 'react-native-markdown-display';
import he from 'he';

export default function Index() {
  const [notes, setNotes] = useState([]);
  const [pinnedNotes, setPinnedNotes] = useState([]);
  const [trash, setTrash] = useState([]);  // State to hold deleted notes
  const [searchQuery, setSearchQuery] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [searchBarHeight] = useState(new Animated.Value(0));  // for smooth animation of search bar
  const searchInputRef = useRef(null);  // Create a reference for the search input
  const router = useRouter();

  // Function to load notes from AsyncStorage
  const loadNotes = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
  
      // Fetch pinned and unpinned notes separately
      const pinnedNoteIds = keys.filter((key) => key.startsWith('pinned_note_'));
      const unpinnedNoteIds = keys.filter((key) => key.startsWith('note_') && !key.startsWith('pinned_note_'));
  
      const fetchNotes = async (ids, isPinned = false) => {
        return await Promise.all(
          ids.map(async (key) => {
            const noteId = key.split('_')[isPinned ? 2 : 1];
            const noteContent = await AsyncStorage.getItem(key);
            const noteTitle = await AsyncStorage.getItem(`${isPinned ? 'pinned_' : ''}title_${noteId}`);
            const noteDate = await AsyncStorage.getItem(`${isPinned ? 'pinned_' : ''}date_${noteId}`);
            return { id: noteId, title: noteTitle || 'Untitled', content: noteContent || '', date: noteDate };
          })
        );
      };
  
      const pinnedNotes = await fetchNotes(pinnedNoteIds, true);
      const unpinnedNotes = await fetchNotes(unpinnedNoteIds);
  
      // Sort notes by date
      const sortByDate = (notes) => notes.sort((a, b) => b.date.localeCompare(a.date));
  
      setPinnedNotes(sortByDate(pinnedNotes));
      setNotes(sortByDate(unpinnedNotes));
    } catch (error) {
      console.error('Error loading notes:', error);
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
          return { id: noteId, title: noteTitle || 'Untitled', content: noteContent || '', date: noteDate };
        })
      );
      setTrash(savedTrash);
    } catch (error) {
      console.error('Error loading trash:', error);
    }
  };

  const clearAsyncStorage = async () => {
    try {
      await AsyncStorage.clear();
      console.log('AsyncStorage cleared successfully!');
      Alert.alert('Success', 'All data has been cleared.');
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
      Alert.alert('Error', 'Unable to clear storage.');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadNotes(); 
      loadTrash();
    }, [])
  );

  // Add a new note
  const addNote = async () => {
    const newNoteId = new Date().toISOString(); 
    const newNote = { id: newNoteId, title: 'Untitled', content: '', date: newNoteId};

    try {
      await AsyncStorage.setItem(`note_${newNoteId}`, newNote.content);
      await AsyncStorage.setItem(`title_${newNoteId}`, newNote.title);
      await AsyncStorage.setItem(`date_${newNoteId}`, newNote.date);
      setNotes((prevNotes) => [newNote, ...prevNotes]); 
      router.push(`/note?id=${newNoteId}`);
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'Unable to add the note.');
    }
  };


  // Delete a note (move to trash) with support for pinned notes
  const deleteNote = async (id) => {
    try {
      const isPinned = pinnedNotes.some((note) => note.id === id);
      const prefix = isPinned ? 'pinned_' : '';
      
      const noteContent = await AsyncStorage.getItem(`${prefix}note_${id}`);
      const noteTitle = await AsyncStorage.getItem(`${prefix}title_${id}`);
      const noteDate = await AsyncStorage.getItem(`${prefix}date_${id}`);

      await AsyncStorage.setItem(`trash_${id}`, noteContent || '');
      await AsyncStorage.setItem(`trash_title_${id}`, noteTitle || 'Untitled');
      await AsyncStorage.setItem(`trash_date_${id}`, noteDate || Date.now());

      await AsyncStorage.removeItem(`${prefix}note_${id}`);
      await AsyncStorage.removeItem(`${prefix}title_${id}`);
      await AsyncStorage.removeItem(`${prefix}date_${id}`);

      if (isPinned) {
        setPinnedNotes((prevPinnedNotes) => prevPinnedNotes.filter((note) => note.id !== id));
      } else {
        setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
      }

      setTrash((prevTrash) => [
        { id, title: noteTitle, content: noteContent, date: noteDate },
        ...prevTrash,
      ]);
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert('Error', 'Unable to delete the note.');
    }
  };


  const togglePinNote = async (id) => {
    try {
      const isPinned = pinnedNotes.some((note) => note.id === id);
  
      setPinnedNotes((prevPinnedNotes) => {
        if (isPinned) {
          return prevPinnedNotes.filter((n) => n.id !== id);
        } else {
          const movedNote = notes.find((n) => n.id === id);
          return [...prevPinnedNotes, movedNote];
        }
      });
  
      setNotes((prevNotes) => {
        if (isPinned) {
          const movedNote = pinnedNotes.find((n) => n.id === id);
          return [...prevNotes, movedNote];
        } else {
          return prevNotes.filter((n) => n.id !== id);
        }
      });
      
      // Emit the event to notify about the pin state change
      EventRegister.emit('pinStateChanged', { id, isPinned: !isPinned });
  
      const prefix = isPinned ? 'pinned_' : '';
      const targetPrefix = isPinned ? '' : 'pinned_';
      const noteContent = await AsyncStorage.getItem(`${prefix}note_${id}`);
      const noteTitle = await AsyncStorage.getItem(`${prefix}title_${id}`);
      const noteDate = await AsyncStorage.getItem(`${prefix}date_${id}`);
  
      await AsyncStorage.removeItem(`${prefix}note_${id}`);
      await AsyncStorage.removeItem(`${prefix}title_${id}`);
      await AsyncStorage.removeItem(`${prefix}date_${id}`);
      await AsyncStorage.setItem(`${targetPrefix}note_${id}`, noteContent || '');
      await AsyncStorage.setItem(`${targetPrefix}title_${id}`, noteTitle || 'Untitled');
      await AsyncStorage.setItem(`${targetPrefix}date_${id}`, noteDate || new Date().toISOString());
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };
  
  


  // Toggle search overlay visibility with smooth transition
  const toggleSearchOverlay = () => {
    if (!overlayVisible) {
      setOverlayVisible(true);
      Animated.timing(searchBarHeight, {
        toValue: 50,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();  // Focus the search input after opening the overlay
        }
      });
    } else {
      Animated.timing(searchBarHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setOverlayVisible(false);
        setSearchQuery('');  // Clear search input when overlay is closed
      });
    }
  };

  const toggleSearchOverlayOff = () => {
    if (overlayVisible) {
      Animated.timing(searchBarHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setOverlayVisible(false);
        setSearchQuery('');  // Clear search input when overlay is closed
      });
    }
  };

  // Handle search input change
  const handleSearchInput = (text) => {
    setSearchQuery(text);
  };


  const markChars = ["#", "*", ">", "_"];

  const escapeMarkdown = (text) => {
    const containsOtherChars = [...text].some(char => !markChars.includes(char));
    if (!containsOtherChars) {
      return text;
    }
    return markChars.reduce((acc, char) => acc.replaceAll(char, ''), text);
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

  // Filtered notes based on search query
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>bluu.md</Text>

      {/* Search Button (Toggle Overlay) */}
      <TouchableOpacity onPress={toggleSearchOverlay} style={styles.searchButton}>
        <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
          <Path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
        </Svg>
      </TouchableOpacity>

      {/* Search Bar with Animation */}
      {overlayVisible && 
        <Animated.View style={[styles.searchBarContainer, { height: searchBarHeight }]}>
          <TextInput
            ref={searchInputRef}  // Attach the ref to the TextInput
            style={styles.searchBar}
            placeholder="Search Notes..."
            onChangeText={handleSearchInput}
            value={searchQuery}
          />
        </Animated.View>
      }

      {pinnedNotes.length !== 0 && 
        <View>
          <Text style={styles.sectionTitle}>Pinned Notes:</Text>
        </View>
      }
      {pinnedNotes.length !== 0 ? (
        <SwipeListView
          style={styles.pinView}
          data={pinnedNotes}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const isFirstItem = index === 0; // Check if this is the first item
            const isLastItem = index === pinnedNotes.length - 1; // Check if this is the last item
            const borderRadiusStyle = {
              borderTopLeftRadius: isFirstItem ? 10 : 0,
              borderTopRightRadius: isFirstItem ? 10 : 0,
              borderBottomLeftRadius: isLastItem ? 10 : 0,
              borderBottomRightRadius: isLastItem ? 10 : 0,
            };

            return (
              <View>
                <View style={[styles.swipeView, borderRadiusStyle]}>
                  <View style={styles.itemList}>
                    <TouchableOpacity
                      onPress={() => router.push(`/note?id=${item.id}`)}
                      style={styles.noteItem}
                    >
                      <View style={styles.noteTitleRow}>
                        <Text style={styles.noteText}>{escapeMarkdown(item.title)}</Text>
                        {/* Add the pinned icon */}
                        <Svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 576 512"
                          width="18"
                          height="18"
                          style={styles.pinnedIcon}
                        >
                          <Path
                            d="M528.1 171.5L382 150.2 316.7 17c-8.4-17-33-17-41.4 0l-65.3 133.2L47.9 171.5c-18.8 3.6-26.3 26-12.7 39.4l105.7 103-25 145.5c-3.2 18.8 16.5 33 33.4 24.2L288 439.6l130.7 68.9c16.8 8.8 36.5-5.4 33.4-24.2l-25-145.5 105.7-103c13.6-13.4 6.1-35.8-12.7-39.4zM388.6 312.3l23.7 138.2L288 402.4l-124.3 65.1 23.7-138.2-100.6-98 139-20.2L288 47.7 336.9 194l139 20.2-100.6 98z"
                            fill="black" // Adjust to your preferred color
                          />
                        </Svg>
                      </View>
                      <Text style={styles.noteDate}>{formatTimestamp(item.date)}</Text>
                    </TouchableOpacity>
                    <View style={styles.hiddenItem}>
                      <TouchableOpacity
                        onPress={() => togglePinNote(item.id)}
                        style={styles.pinButton}
                      >
                        <Text style={styles.pinButtonText}>unstar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteNote(item.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                {/* Add a separator except for the last item */}
                {!isLastItem && <View style={styles.separator} />}
              </View>
            );
          }}
          renderHiddenItem={({ item }) => (
            <View>
              {/* Hidden Item */}
            </View>
          )}
          rightOpenValue={-140}
          stopRightSwipe={-140}
          closeOnRowOpen={true}
          closeOnRowBeginSwipe={true}
        />

      
      ) :
        console.log("hellow!")
      }
      

      

      {notes.length !== 0 && 
        <View>
          <Text style={styles.sectionTitle}>Notes:</Text>
        </View>
      }

      {notes.length === 0 ? (
        <View style={styles.fillBox}>
            <Text style={styles.emptyMessage}>Surely looks kinda empty here...</Text>
        </View>
      ) : (
        // Otherwise, display the list or filtered notes
        
        filteredNotes.length !== 0 ? (
        <SwipeListView
          data={filteredNotes || notes}
          renderItem={({ item, index }) => {
            const isFirstItem = index === 0; // Check if this is the first item
            const isLastItem = index === (filteredNotes || notes).length - 1; // Check if this is the last item
            const borderRadiusStyle = {
              borderTopLeftRadius: isFirstItem ? 10 : 0,
              borderTopRightRadius: isFirstItem ? 10 : 0,
              borderBottomLeftRadius: isLastItem ? 10 : 0,
              borderBottomRightRadius: isLastItem ? 10 : 0,
            };

            return (
              <View style={[styles.swipeView, borderRadiusStyle]}>
                <View style={styles.itemList}>
                  <TouchableOpacity
                    onPress={() => router.push(`/note?id=${item.id}`)}
                    style={styles.noteItem}
                  >
                    <Text style={styles.noteText}>{escapeMarkdown(item.title)}</Text>
                    <Text style={styles.noteDate}>{formatTimestamp(item.date)}</Text>
                  </TouchableOpacity>
                  <View style={styles.hiddenItem}>
                    <TouchableOpacity
                      onPress={() => togglePinNote(item.id)}
                      style={styles.pinButton}
                    >
                      <Text style={styles.pinButtonText}>star</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteNote(item.id)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {!isLastItem && <View style={styles.separator} />}
              </View>
            );
          }}
          renderHiddenItem={({ item }) => (
            <View>
              {/* Hidden Item */}
            </View>
          )}
          rightOpenValue={-140}
          stopRightSwipe={-140}
          closeOnRowOpen={true}
          closeOnRowBeginSwipe={true}
        />
        ) : (
          <View style={styles.fillBox}>
            <Text style={styles.emptyMessage}>Nothing here...</Text>
          </View>
        )
      )}

      {/* Add New Note Button */}
      <TouchableOpacity onPress={ () => {addNote(); toggleSearchOverlayOff();}} style={styles.addButton}>
        <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="20" height="20">
          <Path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z"/>
        </Svg>
      </TouchableOpacity>

      {/* Trash Button */}
      <TouchableOpacity onPress={() => router.push('/trash')} style={styles.trashButton}>
        <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="20" height="20">
          <Path d="M268 416c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-208c0-17.7 14.3-32 32-32s32 14.3 32 32l0 208zM88 464c-26.5 0-48-21.5-48-48V112H12C5.4 112 0 106.6 0 100V84c0-13.3 10.7-24 24-24h80V32c0-17.7 14.3-32 32-32H312c17.7 0 32 14.3 32 32V60h80c13.3 0 24 10.7 24 24v16c0 6.6-5.4 12-12 12h-28v304c0 26.5-21.5 48-48 48H88z"/>
        </Svg>
      </TouchableOpacity>

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
    marginTop: 40,
  },
  searchButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchButtonText: {
    color: '#000000',
    fontSize: 18,
  },
  searchBarContainer: {
    overflow: 'hidden', // hides search bar when collapsed
    marginBottom: 20,
  },
  searchBar: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingLeft: 10,
    marginBottom: 20,
  },
  swipeView: {
    borderRadius: 5,
    backgroundColor: '#f5f5f5',
  },
  fillBox: {
    flex: 1,
  },
  separator: {
    height: 0.5,  // Thin separator
    backgroundColor: 'grey',  // Black separator
    marginVertical: 0,  // Space between items
    width: '100%',  // Adjust width to be shorter (e.g., 80% of the parent container)
    alignSelf: 'center',  // Center the separator horizontally
  },
  pinSeparator: {
    height: 0.8,  // Thin separator
    backgroundColor: 'black',  // Black separator
    marginTop: 10,  // Space between items
    marginBottom: 10,  // Space between items
    width: '100%',  // Adjust width to be shorter (e.g., 80% of the parent container)
    alignSelf: 'center',  // Center the separator horizontally
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  noteText: {
    color: '#3e3e3e',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noteDate: {
    color: '#808080',
    fontSize: 12,
  },
  addButton: {
    alignSelf: 'flex-end',
    padding: 10,
    marginVertical: 20,
    borderRadius: 5,
    alignItems: 'center',
  },
  trashButton: {
    alignSelf: 'flex-end',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
  },
  itemList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
    borderRadius: 5,
    justifyContent: 'space-between', // Make sure the note and delete button are spaced out
  },
  pinView: {

    flexGrow: 0,
  },
  pinnedIcon: {
    marginLeft: 10,
    tintColor: 'gold', // Optional: Add color for the icon (e.g., gold for a star)
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  noteItem: {
    flex: 1,  // Take up the full space of the note item
    padding: 10,
  },
  hiddenItem: {
    position: 'absolute',
    flexDirection: 'row',
    right: -140, // Align the buttons properly to the right
    top: 0,
    bottom: 0,
    width: 140, // Match `rightOpenValue` in SwipeListView
    justifyContent: 'space-between', // Ensure space between pin and delete buttons
    alignItems: 'center',
    backgroundColor: '#f5f5f5', // Match background to avoid overlap appearance
    borderBottomRightRadius: 5,
    borderTopRightRadius: 5,
  },
  
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '50%', // Adjust width for spacing
    height: '60%',
    backgroundColor: '',
    borderBottomRightRadius: 5,
    borderTopRightRadius: 5,
  },
  
  pinButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '50%', // Adjust width for spacing
    height: '60%',
    backgroundColor: '',
    borderRightWidth: 1,
  },
  deleteButtonText: {
    color: '#3e3e3e',
    fontWeight: 'bold',
    fontSize: 12,
  },
  pinButtonText: {
    color: '#3e3e3e',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyMessage: {
    color: '#808080',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
  },
});