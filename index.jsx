import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    deleteDoc, 
    doc 
} from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';

// Define the global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Helper function to convert file to Base64 string
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Extract the Base64 part (after the comma in the data URI)
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};

const Header = ({ userId, isLoading }) => (
    <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">
            <span className="text-indigo-600">Secure</span> Data Vault
        </h1>
        <p className="text-sm text-gray-500">
            {isLoading ? 'Loading authentication...' : (
                <>
                    <span className="font-medium">User ID:</span> 
                    <code className="text-xs ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                        {userId || 'N/A'}
                    </code>
                </>
            )}
        </p>
    </div>
);

const Tabs = ({ uploadType, setUploadType }) => (
    <div className="flex bg-white rounded-t-xl overflow-hidden border-b border-gray-200">
        <TabButton 
            isActive={uploadType === 'text'} 
            onClick={() => setUploadType('text')}
        >
            Paste Text/Code
        </TabButton>
        <TabButton 
            isActive={uploadType === 'file'} 
            onClick={() => setUploadType('file')}
        >
            Upload File (Base64)
        </TabButton>
    </div>
);

const TabButton = ({ isActive, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3 px-4 text-center font-semibold transition-colors duration-200
            ${isActive 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
    >
        {children}
    </button>
);

const InputForm = ({ uploadType, saveContent, isAuthReady }) => {
    const [pasteTitle, setPasteTitle] = useState('');
    const [pasteText, setPasteText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving || !isAuthReady) return;

        setIsSaving(true);
        setMessage('');

        try {
            if (uploadType === 'text') {
                if (!pasteText.trim()) throw new Error('Paste content cannot be empty.');
                
                await saveContent({
                    type: 'text',
                    filename: pasteTitle.trim() || `Untitled Paste - ${new Date().toLocaleString()}`,
                    content: pasteText,
                    mimeType: 'text/plain',
                });

                setPasteText('');
                setPasteTitle('');
                setMessage('Text paste saved successfully!');

            } else if (uploadType === 'file') {
                if (!selectedFile) throw new Error('Please select a file to upload.');

                const base64Content = await fileToBase64(selectedFile);

                await saveContent({
                    type: 'file',
                    filename: selectedFile.name,
                    content: base64Content,
                    mimeType: selectedFile.type || 'application/octet-stream',
                });
                
                setSelectedFile(null);
                setMessage(`File '${selectedFile.name}' saved and encoded to Base64.`);
            }
        } catch (error) {
            console.error('Error saving content:', error);
            setMessage(`Error: ${error.message || 'Could not save content.'}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(''), 5000); // Clear message after 5 seconds
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-white shadow-lg rounded-b-xl space-y-4">
            {uploadType === 'text' && (
                <>
                    <input
                        type="text"
                        placeholder="Title (optional, e.g., 'React Hook Logic')"
                        value={pasteTitle}
                        onChange={(e) => setPasteTitle(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <textarea
                        placeholder="Paste your text or code here..."
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        rows="8"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                        required
                    />
                </>
            )}

            {uploadType === 'file' && (
                <div className="space-y-3">
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
                        Select a file to upload:
                    </label>
                    <input
                        id="file-upload"
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100"
                        required={uploadType === 'file'}
                    />
                    {selectedFile && (
                        <p className="text-sm text-gray-500">
                            Selected: **{selectedFile.name}** ({Math.round(selectedFile.size / 1024)} KB). 
                            Will be encoded to Base64 and saved.
                        </p>
                    )}
                </div>
            )}
            
            <button
                type="submit"
                disabled={isSaving || !isAuthReady}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-colors duration-200 shadow-md
                    ${isAuthReady && !isSaving 
                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
            >
                {isSaving ? 'Saving...' : `Save ${uploadType === 'text' ? 'Paste' : 'File'}`}
            </button>

            {message && (
                <div className={`p-3 text-center rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            {!isAuthReady && (
                <div className="p-3 text-center rounded-lg bg-yellow-100 text-yellow-700">
                    Initializing database connection...
                </div>
            )}
        </form>
    );
};

const ItemCard = ({ item, deleteContent }) => {
    // Create the Data URI for files/text for viewing/download
    const dataUri = useMemo(() => 
        `data:${item.mimeType};base64,${item.content}`
    , [item.mimeType, item.content]);

    const handleCopy = () => {
        // Copy original content (either text or base64 string)
        const contentToCopy = item.type === 'text' ? item.content : item.content; 
        
        try {
            // navigator.clipboard.writeText might be blocked in some environments (like iframes)
            // Use document.execCommand('copy') as a fallback/alternative.
            const textarea = document.createElement('textarea');
            textarea.value = contentToCopy;
            textarea.style.position = 'fixed';
            textarea.style.opacity = 0;
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            alert('Content copied to clipboard!'); // Custom alert substitute is fine here for simple notification
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Could not copy content. See console for error.');
        }
    };
    
    // Format the date for display
    const formattedDate = new Date(item.createdAt).toLocaleString();

    return (
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 break-words max-w-[80%]">
                        {item.filename}
                    </h3>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap
                        ${item.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}
                    >
                        {item.type === 'text' ? 'Paste' : 'File'}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    Saved: {formattedDate}
                </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {/* Download/View Link */}
                <a 
                    href={dataUri} 
                    download={item.filename} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[100px] text-center px-3 py-1.5 text-sm font-medium rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                    {item.type === 'text' ? 'View/Download' : 'Download File'}
                </a>
                
                {/* Copy Button */}
                <button
                    onClick={handleCopy}
                    className="flex-1 min-w-[100px] text-center px-3 py-1.5 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    Copy Content
                </button>

                {/* Delete Button */}
                <button
                    onClick={() => deleteContent(item.id, item.filename)}
                    className="w-full sm:w-auto px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                    Delete
                </button>
            </div>
            {item.type === 'file' && (
                 <p className="text-xs text-gray-400 mt-2">Mime Type: {item.mimeType}</p>
            )}
        </div>
    );
};

// Main App Component
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploadType, setUploadType] = useState('text'); // 'text' or 'file'

    // 1. Firebase Initialization and Authentication
    useEffect(() => {
        if (Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase config is missing.");
            return;
        }
        
        // Use Debug logging for Firestore
        setLogLevel('debug'); 

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);
        
        setDb(firestore);
        setAuth(firebaseAuth);

        const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
            if (!user) {
                // Try to sign in using the provided custom token or anonymously
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        console.log("Signed in with custom token.");
                    } else {
                        await signInAnonymously(firebaseAuth);
                        console.log("Signed in anonymously.");
                    }
                } catch (error) {
                    console.error("Error during authentication:", error);
                }
            } else {
                setUserId(user.uid);
                setIsAuthReady(true);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // 2. Firestore Utility Functions
    const getUserCollectionRef = useCallback((dbInstance, uid) => {
        if (!dbInstance || !uid) return null;
        // Path: /artifacts/{appId}/users/{userId}/files
        return collection(dbInstance, `artifacts/${appId}/users/${uid}/files`);
    }, []);

    const saveContent = useCallback(async (data) => {
        if (!db || !userId) {
            console.error("Database or User ID not ready.");
            return;
        }

        const filesCollectionRef = getUserCollectionRef(db, userId);
        if (!filesCollectionRef) return;

        const docData = {
            ...data,
            userId: userId,
            createdAt: Date.now(),
        };

        await addDoc(filesCollectionRef, docData);
    }, [db, userId, getUserCollectionRef]);

    const deleteContent = useCallback(async (itemId, itemName) => {
        if (!db || !userId) {
            console.error("Database or User ID not ready.");
            return;
        }

        // Custom modal replacement for alert/confirm
        if (!window.confirm(`Are you sure you want to delete '${itemName}'?`)) {
            return;
        }

        try {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/files`, itemId);
            await deleteDoc(docRef);
            console.log(`Document with ID ${itemId} deleted.`);
        } catch (error) {
            console.error("Error deleting document:", error);
        }
    }, [db, userId]);

    // 3. Firestore Real-time Subscription
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            setFiles([]);
            return;
        }

        const filesCollectionRef = getUserCollectionRef(db, userId);
        if (!filesCollectionRef) return;

        console.log(`Attaching snapshot listener for user: ${userId}`);
        
        // onSnapshot listener for real-time updates
        const unsubscribe = onSnapshot(filesCollectionRef, (snapshot) => {
            const fetchedFiles = [];
            snapshot.forEach((doc) => {
                fetchedFiles.push({ id: doc.id, ...doc.data() });
            });

            // Sort data by createdAt descending (newest first) in memory
            fetchedFiles.sort((a, b) => b.createdAt - a.createdAt);
            
            setFiles(fetchedFiles);
            console.log(`Fetched ${fetchedFiles.length} items in real-time.`);
        }, (error) => {
            console.error("Error listening to Firestore:", error);
        });

        return () => {
            console.log("Detaching snapshot listener.");
            unsubscribe(); // Clean up the listener on component unmount/dependency change
        };
    }, [db, userId, isAuthReady, getUserCollectionRef]);

    return (
        <div className="min-h-screen bg-gray-100 font-sans flex justify-center p-4 sm:p-8">
            <div className="w-full max-w-4xl space-y-6">
                <Header userId={userId} isLoading={!isAuthReady} />

                <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                    <Tabs uploadType={uploadType} setUploadType={setUploadType} />
                    <InputForm 
                        uploadType={uploadType} 
                        saveContent={saveContent} 
                        isAuthReady={isAuthReady}
                    />
                </div>

                {/* Saved Files/Pastes List */}
                <div className="pt-4">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Saved Items ({files.length})</h2>
                    {files.length === 0 && isAuthReady ? (
                        <div className="p-10 text-center bg-white rounded-xl shadow-md text-gray-500">
                            You have no saved items yet. Use the form above to store your first paste or file!
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                            {files.map(item => (
                                <ItemCard 
                                    key={item.id} 
                                    item={item} 
                                    deleteContent={deleteContent} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;

