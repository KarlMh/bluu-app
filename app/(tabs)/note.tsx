//notes.tsx

import React, { useState, useEffect, useRef, Children } from 'react';
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
    <ScrollView 
      style={styles.markdownWrapperDesktop}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      >
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
    color: '#000',
    marginVertical: 8,
  },
  heading1: {
    fontSize: 28,
    marginBottom: 8,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  heading2: {
    fontSize: 24,
    marginBottom: 6,
    fontWeight: '500',
    color: '#333',
  },
  heading3: {
    fontSize: 22,
    marginBottom: 5,
    fontWeight: '500',
    color: '#333',
  },
  heading4: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: '500',
    color: '#555',
  },
  heading5: {
    fontSize: 16,
    marginBottom: 3,
    fontWeight: '500',
    color: '#555',
  },
  heading6: {
    fontSize: 14,
    marginBottom: 2,
    fontWeight: '500',
    color: '#555',
  },
  strong: {
    fontWeight: '600',
    color: '#000',
  },
  em: {
    fontStyle: 'italic',
    color: '#000',
  },
  s: {
    textDecorationLine: 'line-through',
    color: '#000',
  },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: '#ccc',
    paddingLeft: 8,
    marginVertical: 6,
    color: '#666',
    fontStyle: 'italic',
    fontSize: 15,
  },
  bullet_list: {
    paddingLeft: 18,
    listStyleType: 'disc',
  },
  ordered_list: {
    paddingLeft: 18,
    listStyleType: 'decimal',
  },
  list_item: {
    marginVertical: 3,
    color: '#000',
    fontSize: 16,
  },
  ordered_list_icon: {
    marginRight: 8,
  },
  ordered_list_content: {
    fontSize: 16,
    color: '#000',
  },
  bullet_list_icon: {
    marginRight: 8,
  },
  bullet_list_content: {
    fontSize: 16,
    color: '#000',
  },
  code_inline: {
    backgroundColor: '#eaeaea',
    padding: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    color: '#000',
    fontSize: 14,
  },
  code_block: {
    backgroundColor: '#eaeaea',
    padding: 10,
    borderRadius: 4,
    fontFamily: 'monospace',
    color: '#000',
    fontSize: 14,
    overflowX: 'auto',
  },
  fence: {
    backgroundColor: '#eaeaea',
    padding: 10,
    borderRadius: 4,
    fontFamily: 'monospace',
    color: '#000',
    fontSize: 14,
    overflowX: 'auto',
  },


  table: {
    width: '100%',
    marginVertical: 10,
    borderCollapse: 'collapse',
    borderSpacing: 0, // Ensures no space between cells
    border: 'none', // Remove the outer border
    borderWidth: 0,
  },
  
  thead: {
    backgroundColor: '#f0f0f0',
    fontWeight: '600',
    color: '#333',
    padding: 12,
    textAlign: 'center',
    borderBottom: '2px solid #ccc', // Adds a bottom border to the header for separation
  },
  
  tbody: {
    textAlign: 'left',
  },
  
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  
  td: {
    padding: 12,
    fontSize: 16,
    color: '#000',
    textAlign: 'left',
    verticalAlign: 'middle', // Ensures vertical alignment of text in cells
  },
  
  th: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    borderBottom: '2px solid #ccc', // Adds a bottom border to header cells
  },
  
  // Alternating row background colors for readability
  tableRowEven: {
    backgroundColor: '#f9f9f9', // Light background color for even rows
  },
  
  tableRowOdd: {
    backgroundColor: '#ffffff', // Default background color for odd rows
  },
  

  
  link: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  blocklink: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  image: {
    marginVertical: 8,
    alignSelf: 'center',
  },
  text: {
    color: '#000',
  },
  textgroup: {
    color: '#000',
  },
  paragraph: {
    marginBottom: 10,
  },
  hardbreak: {
    marginBottom: 10,
  },
  softbreak: {
    marginBottom: 5,
  },
  pre: {
    backgroundColor: '#f4f4f4',
    padding: 10,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 14,
    overflowX: 'auto',
  },
  inline: {
    color: '#000',
  },
  span: {
    color: '#000',
  },
  footnote: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
  },
  task_list_item: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  task_list_item_checkmark: {
    marginRight: 8,
  },
  comment: {
    display: 'none',
  },
};



export default Note;