import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { Box } from '@mui/material';

function Editor({ value, onChange, language, path }) {
  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <MonacoEditor
        height="100%"
        language={language || 'plaintext'}
        theme="vs-dark"
        value={value}
        path={path}
        onChange={onChange}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          folding: true,
          bracketPairColorization: { enabled: true },
        }}
      />
    </Box>
  );
}

export default Editor;
