//notes.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  TextInput,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  TouchableWithoutFeedback,
  Modal,
  Linking,
} from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventRegister } from 'react-native-event-listeners';
import Markdown, { MarkdownIt, hasParents } from 'react-native-markdown-display';

const Note = () => {
  const { id } = useGlobalSearchParams();
  const [noteContent, setNoteContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);
  const [isCheatSheetVisible, setIsCheatSheetVisible] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [viewMode, setViewMode] = useState('edit');
  const [hasAddedHash, setHasAddedHash] = useState(false); // New state variable


  useEffect(() => {
    if (id) loadNote();
  }, [id]);

  useEffect(() => {
    if (noteContent !== initialContent) {
      saveNote();
      const now = new Date().toISOString();
      setDate(now); // Update the local state for the date
      AsyncStorage.setItem(`date_${id}`, now); // Persist the new date in AsyncStorage
    }
  }, [noteContent, initialContent]);

  const loadNote = async () => {
    try {
      // Listen for pin state changes and update the note accordingly
      const listener = EventRegister.addEventListener('pinStateChanged', ({ id: eventId, isPinned }) => {
        if (eventId === id) {
          loadNoteFromStorage(isPinned);
        }
      });
  
      // Load the note from storage initially
      const savedPinnedNote = await AsyncStorage.getItem(`pinned_note_${id}`);
      const isPinned = savedPinnedNote !== null;
  
      // Load the note based on its pinned state
      await loadNoteFromStorage(isPinned);
  
      // Clean up listener on unmount
      return () => {
        EventRegister.removeEventListener(listener);
      };
    } catch (error) {
      console.error('Error loading note:', error);
    }
  };
  
  // Helper function to load the note from AsyncStorage
  const loadNoteFromStorage = async (isPinned) => {
    try {
      const prefix = isPinned ? 'pinned_' : '';
      const savedNote = await AsyncStorage.getItem(`${prefix}note_${id}`);
      const savedTitle = await AsyncStorage.getItem(`${prefix}title_${id}`);
  
      setNoteContent(savedNote || '');
      setInitialContent(savedNote || '');
      setTitle(savedTitle || 'Untitled');
      updateCounts(savedNote || '');
  
      console.log('Loaded Note:', {
        id,
        isPinned,
        content: savedNote,
        title: savedTitle,
      });

      if(savedNote !== '' && savedNote !== null){
        setViewMode('preview');
      }
      
    } catch (error) {
      console.error('Error loading note from storage:', error);
    }
  };
  

  const saveNote = async () => {
    try {
      // Determine if the note is pinned
      const savedPinnedNote = await AsyncStorage.getItem(`pinned_note_${id}`);
      const isPinned = savedPinnedNote !== null;
  
      // Use the appropriate prefix
      const prefix = isPinned ? 'pinned_' : '';
  
      // Save the note content
      await AsyncStorage.setItem(`${prefix}note_${id}`, noteContent);
  
      // Save the title (first line of the content)
      let firstLine = noteContent.split('\n')[0] || 'Untitled';
      firstLine = firstLine.length > 50 ? firstLine.substring(0, 80) + '...' : firstLine;      

      await AsyncStorage.setItem(`${prefix}title_${id}`, firstLine);
  
      // Save the last edited date
      const now = new Date().toISOString();
      await AsyncStorage.setItem(`${prefix}date_${id}`, now);
  
      // Emit an event to notify other components
      EventRegister.emit('noteUpdated', { id, title: firstLine });
  
      // Update the initial content to reflect the saved state
      setInitialContent(noteContent);
  
      console.log('Note saved:', {
        id,
        isPinned,
        title: firstLine,
        content: noteContent,
        date: now,
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };
  

  const dismissKeyboard = () => Keyboard.dismiss();

  const toggleViewMode = () => setViewMode((prev) => (prev === 'edit' ? 'preview' : 'edit'));

  const toggleCheatSheet = () => setIsCheatSheetVisible((prev) => !prev);

  const openCheatSheet = () => Linking.openURL('https://www.npmjs.com/package/react-native-markdown-display#syntax-support');

  const updateCounts = (content) => {
    const words = content.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
    setCharacterCount(content.length);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.contentWrapper}>
          {Platform.OS !== 'ios' && Platform.OS !== 'android' ? (
            <DesktopView
              inputRef={inputRef}
              noteContent={noteContent}
              setNoteContent={setNoteContent}
              viewMode={viewMode}
              hasAddedHash={hasAddedHash}
              setHasAddedHash={setHasAddedHash}
              updateCounts={updateCounts}
            />
          ) : viewMode === 'edit' ? (
            <TextInput
              ref={inputRef}
              style={[styles.input, styles.mobileInput]}
              placeholder="Write your note here..."
              value={noteContent}
              onChangeText={(text) => {
                if (!hasAddedHash && text.length > 0) {
                  // Prefix `#` to the first line
                  const updatedText = text.startsWith('#') ? text : `# ${text}`;
                  setNoteContent(updatedText);
                  setHasAddedHash(true); // Ensure this behavior runs only once
                } else {
                  setNoteContent(text);
                }
                updateCounts(text); // Update word and character counts
              }}
              multiline
              autoFocus
              returnKeyType="done"
              onSubmitEditing={dismissKeyboard}
            />
          ) : (
            <ScrollView 
            style={[styles.markdownWrapper, styles.mobileInput]}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled" // Ensure taps are passed through
            showsVerticalScrollIndicator={true} // Explicitly show scrollbars
            nestedScrollEnabled={true} // Support nested scrolling if necessary
            >
              <Markdown markdownit={MarkdownIt({linkify: true, typographer: true, breaks: true})} style={markdownStyles}>{noteContent}</Markdown>
            </ScrollView>
          )}
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.tabContainerUnified}>
        <ViewModeButtons viewMode={viewMode} setViewMode={setViewMode} />
        <TouchableOpacity onPress={openCheatSheet} style={styles.tabButton}>
          <Text style={styles.tabButtonText}>Cheat Sheet</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerContainerUnified}>
        <Text style={styles.footerText}>Word Count: {wordCount}</Text>
        <Text style={styles.footerText}>Character Count: {characterCount}</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const DesktopView = ({ inputRef, noteContent, setNoteContent, viewMode, hasAddedHash, setHasAddedHash, updateCounts }) => (
  <View style={styles.rowContainerDesktop}>
    {viewMode === 'edit' && (
      <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
        <View style={{ flex: 1 }}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { outline: 'none' }]}
            placeholder="Write your note here..."
            value={noteContent}
            onChangeText={(text) => {
              if (!hasAddedHash && text.length < 2) {
                // Prefix `#` to the first line
                const updatedText = text.startsWith('#') ? text : `# ${text}`;
                setNoteContent(updatedText);
                setHasAddedHash(true); // Ensure this behavior runs only once
              } else {
                setNoteContent(text);
              }
              updateCounts(text);
            }}
            multiline
            autoFocus
            returnKeyType="done"
          />
        </View>
      </TouchableWithoutFeedback>
    )}
    <View style={styles.separator} />
    <ScrollView style={styles.markdownWrapperDesktop}>
      <Markdown markdownit={MarkdownIt({linkify: true, typographer: true, breaks: true})} style={markdownStyles}>{noteContent}</Markdown>
    </ScrollView>
  </View>
);


const ViewModeButtons = ({ viewMode, setViewMode }) => (
  Platform.OS !== 'ios' && Platform.OS !== 'android' ? (
    <TouchableOpacity
      onPress={() => setViewMode((prev) => (prev === 'edit' ? 'preview' : 'edit'))}
      style={[styles.tabButton, viewMode === 'edit' && styles.activeTabButton]}
    >
      <Text style={styles.tabButtonText}>{viewMode === 'edit' ? 'Preview' : 'Edit'}</Text>
    </TouchableOpacity>
  ) : (
    <>
      <TouchableOpacity
        onPress={() => setViewMode('edit')}
        style={[styles.tabButton, viewMode === 'edit' && styles.activeTabButton]}
      >
        <Text style={styles.tabButtonText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setViewMode('preview')}
        style={[styles.tabButton, viewMode === 'preview' && styles.activeTabButton]}
      >
        <Text style={styles.tabButtonText}>Preview</Text>
      </TouchableOpacity>
    </>
  )
);


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  rowContainerDesktop: {
    flexDirection: 'row',
    flex: 1,
    marginTop:64,
  },
  contentWrapper: {
    flex: 1,
    
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    padding: 20,

  },
  mobileInput: {
    marginTop: 90,
    padding: 20,
  },
  markdownWrapperDesktop: {
    flex: 1,
    padding: 20,
  },
  markdownWrapper: {
    flex: 1,
    padding: 20,
  },
  separator: {
    width: 1,

    backgroundColor: '#ccc',
  },
  tabContainerUnified: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
    paddingVertical: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#000',
  },
  tabButtonText: {
    fontSize: 16,
    color: '#000',
  },
  footerContainerUnified: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
  },
  footerText: {
    fontSize: 14,
    color: '#333',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  closeButton: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
  },
  heading1: {
    fontSize: 24,
    marginBottom: 8,
    fontWeight: '600',
    color: '#000',
  },
  heading2: {
    fontSize: 20,
    marginBottom: 6,
    fontWeight: '500',
    color: '#333',
  },
  strong: {
    fontWeight: '600',
    color: '#000',
  },
  em: {
    fontStyle: 'italic',
    color: '#000',
  },
  code: {
    backgroundColor: '#eaeaea',
    padding: 4,
    borderRadius: 4,
    fontFamily: 'monospace',
    color: '#000',
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#ccc',
    paddingLeft: 10,
    marginVertical: 8,
    color: '#666',
  },
  bullet_list: {
    paddingLeft: 20,
  },
  ordered_list: {
    paddingLeft: 20,
  },
  list_item: {
    marginVertical: 4,
    color: '#000',
  },
  link: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  hr: {
    marginVertical: 20,
  },
  // Add custom styling for images
  image: {
    width: '100%',            // Ensure image takes up full width of the parent container
    height: '100%',              // Fixed height for the image
    resizeMode: 'contain',    // Ensure the image is contained within the width/height constraints
    marginVertical: 10,       // Vertical space around the image
    position: 'static',     // Ensure image is positioned correctly inside its container
  },
};

export default Note;