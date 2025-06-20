import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Bot, User, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AISettings, { AISettings as AISettingsType } from "@/components/AISettings";
import Toolbar from "@/components/Toolbar";
import BasicInfoSection from "@/components/CharacterForm/BasicInfoSection";
import PersonalitySection from "@/components/CharacterForm/PersonalitySection";
import PromptsSection from "@/components/CharacterForm/PromptsSection";
import AlternateGreetings from "@/components/CharacterForm/AlternateGreetings";
import CharacterBook from "@/components/CharacterForm/CharacterBook";
import TagsSection from "@/components/CharacterForm/TagsSection";
import MetadataSection from "@/components/CharacterForm/MetadataSection";
import CharacterPreview from "@/components/CharacterPreview";
import AIAssistant from "@/components/CharacterForm/AIAssistant";

interface CharacterBookEntry {
  keys: string[];
  content: string;
  insertion_order: number;
  enabled: boolean;
}

interface CharacterCardV3 {
  spec: string;
  spec_version: string;
  data: {
    name: string;
    nickname?: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    creator_notes_multilingual?: {
      [key: string]: string;
    };
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    character_book?: {
      entries: CharacterBookEntry[];
    };
    tags: string[];
    creator: string;
    character_version: string;
    creation_date?: string;
    modification_date?: string;
    source?: string;
    extensions: Record<string, any>;
  };
}

const Index = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("assistant");
  const [aiSettings, setAISettings] = useState<AISettingsType | null>(null);

  const [characterData, setCharacterData] = useState<CharacterCardV3>({
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "",
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      character_book: {
        entries: []
      },
      tags: [],
      creator: "",
      character_version: "1.0",
      creation_date: new Date().toISOString().split('T')[0],
      modification_date: new Date().toISOString().split('T')[0],
      extensions: {}
    }
  });

  const [characterImage, setCharacterImage] = useState<string | null>(null);

  useEffect(() => {
    // 加载保存的AI设置
    const savedSettings = localStorage.getItem('ai-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setAISettings(parsedSettings);
      } catch (error) {
        console.error('Failed to load AI settings:', error);
      }
    }
  }, []);

  const handleAISettingsChange = (newSettings: AISettingsType) => {
    setAISettings(newSettings);
    toast({
      title: t('settingsUpdated') || "设置已更新",
      description: t('settingsUpdatedDesc') || "AI设置已成功更新并保存",
    });
  };

  const updateField = (field: string, value: any) => {
    setCharacterData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [field]: value,
        modification_date: new Date().toISOString().split('T')[0]
      }
    }));
  };

  const handleInsertField = (field: string, value: string | string[]) => {
    if (field === 'tags' && Array.isArray(value)) {
      // 合并现有标签和新标签，去重
      const existingTags = characterData.data.tags || [];
      const newTags = [...new Set([...existingTags, ...value])];
      updateField('tags', newTags);
    } else {
      updateField(field, value);
    }
  };

  const extractPNGCharacterData = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          console.log('PNG file size:', uint8Array.length);
          
          // 方法1: 查找PNG tEXt块
          let foundData = null;
          
          // PNG tEXt块查找
          for (let i = 8; i < uint8Array.length - 8; i++) {
            // 读取块长度
            const chunkLength = (uint8Array[i] << 24) | (uint8Array[i+1] << 16) | (uint8Array[i+2] << 8) | uint8Array[i+3];
            
            // 检查是否是tEXt块 (0x74455874)
            if (uint8Array[i+4] === 0x74 && uint8Array[i+5] === 0x45 && 
                uint8Array[i+6] === 0x58 && uint8Array[i+7] === 0x74) {
              
              console.log('Found tEXt chunk at:', i, 'length:', chunkLength);
              
              const textStart = i + 8;
              const textEnd = textStart + chunkLength;
              
              if (textEnd <= uint8Array.length) {
                try {
                  // 查找关键字结束位置（null字节）
                  let keyEnd = textStart;
                  while (keyEnd < textEnd && uint8Array[keyEnd] !== 0) {
                    keyEnd++;
                  }
                  
                  // 使用UTF-8解码关键字
                  const keyword = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array.slice(textStart, keyEnd));
                  console.log('tEXt keyword:', keyword);
                  
                  // 检查是否是角色卡相关的关键字
                  if (keyword === 'chara' || keyword === 'ccv3' || keyword === 'ccv2' || keyword === 'Comment') {
                    const dataStart = keyEnd + 1;
                    const textDataBytes = uint8Array.slice(dataStart, textEnd);
                    
                    console.log('Found potential character data, length:', textDataBytes.length);
                    
                    // 尝试base64解码
                    try {
                      // 首先用UTF-8解码
                      const textData = new TextDecoder('utf-8', { fatal: false }).decode(textDataBytes);
                      const decoded = atob(textData);
                      
                      // 将base64解码后的字节转换为UTF-8字符串
                      const decodedBytes = new Uint8Array(decoded.length);
                      for (let j = 0; j < decoded.length; j++) {
                        decodedBytes[j] = decoded.charCodeAt(j);
                      }
                      const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(decodedBytes);
                      const parsed = JSON.parse(decodedText);
                      
                      console.log('Successfully parsed base64 JSON with UTF-8 handling');
                      foundData = parsed;
                      break;
                    } catch (e) {
                      // 尝试直接JSON解析
                      try {
                        const textData = new TextDecoder('utf-8', { fatal: false }).decode(textDataBytes);
                        const parsed = JSON.parse(textData);
                        console.log('Successfully parsed direct JSON with UTF-8 handling');
                        foundData = parsed;
                        break;
                      } catch (e2) {
                        console.log('Failed to parse as JSON');
                      }
                    }
                  }
                } catch (e) {
                  console.log('Error processing tEXt chunk:', e);
                }
              }
              
              // 跳到下一个块
              i += 8 + chunkLength + 4 - 1; // -1因为for循环会+1
            }
          }
          
          // 方法2: 如果tEXt块方法失败，尝试字符串搜索
          if (!foundData) {
            console.log('tEXt method failed, trying string search...');
            
            // 使用UTF-8解码器处理整个文件
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const fullText = decoder.decode(uint8Array);
            
            // 查找可能的JSON起始位置
            const jsonPatterns = [
              /"spec"\s*:\s*"chara_card_v[123]"/g,
              /"name"\s*:\s*"/g,
              /\{\s*"name"\s*:/g,
              /\{\s*"char_name"\s*:/g
            ];
            
            for (const pattern of jsonPatterns) {
              const matches = [...fullText.matchAll(pattern)];
              console.log(`Pattern ${pattern.source} found ${matches.length} matches`);
              
              for (const match of matches) {
                if (!match.index) continue;
                
                // 向后查找JSON开始的大括号
                let jsonStart = match.index;
                while (jsonStart > 0 && fullText[jsonStart] !== '{') {
                  jsonStart--;
                }
                
                if (jsonStart >= 0) {
                  // 向前查找JSON结束
                  let braceCount = 0;
                  let jsonEnd = -1;
                  
                  for (let i = jsonStart; i < fullText.length; i++) {
                    if (fullText[i] === '{') braceCount++;
                    if (fullText[i] === '}') braceCount--;
                    if (braceCount === 0 && i > jsonStart) {
                      jsonEnd = i + 1;
                      break;
                    }
                  }
                  
                  if (jsonEnd > jsonStart) {
                    try {
                      const jsonStr = fullText.substring(jsonStart, jsonEnd);
                      const parsed = JSON.parse(jsonStr);
                      console.log('Successfully parsed JSON from string search with UTF-8');
                      foundData = parsed;
                      break;
                    } catch (e) {
                      console.log('Failed to parse extracted JSON');
                    }
                  }
                }
              }
              
              if (foundData) break;
            }
          }
          
          // 方法3: 查找base64编码的数据
          if (!foundData) {
            console.log('String search failed, trying base64 search...');
            
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const fullText = decoder.decode(uint8Array);
            
            // 查找长的base64字符串
            const base64Pattern = /[A-Za-z0-9+/]{100,}={0,2}/g;
            const base64Matches = [...fullText.matchAll(base64Pattern)];
            
            console.log(`Found ${base64Matches.length} potential base64 strings`);
            
            for (const match of base64Matches) {
              try {
                const decoded = atob(match[0]);
                
                // 将base64解码后的字节转换为UTF-8字符串
                const decodedBytes = new Uint8Array(decoded.length);
                for (let j = 0; j < decoded.length; j++) {
                  decodedBytes[j] = decoded.charCodeAt(j);
                }
                const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(decodedBytes);
                
                if (decodedText.includes('"name"') || decodedText.includes('"char_name"') || decodedText.includes('chara_card')) {
                  const parsed = JSON.parse(decodedText);
                  console.log('Successfully parsed base64 character data with UTF-8');
                  foundData = parsed;
                  break;
                }
              } catch (e) {
                // 继续尝试下一个
              }
            }
          }
          
          if (foundData) {
            console.log('Character data found:', foundData);
            resolve(foundData);
          } else {
            console.log('No character data found in PNG');
            reject(new Error('No character data found in PNG'));
          }
        } catch (error) {
          console.error('PNG parsing error:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let parsedData;
      
      if (file.name.endsWith('.json')) {
        // 处理JSON文件 - 清除之前的图片
        setCharacterImage(null);
        
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read JSON file'));
          reader.readAsText(file);
        });
        
        parsedData = JSON.parse(content);
      } else if (file.name.endsWith('.png')) {
        // 处理PNG文件
        parsedData = await extractPNGCharacterData(file);
        
        // 如果成功从PNG提取数据，同时将PNG图片设置为角色头像
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setCharacterImage(result);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: t('hint') || "提示",
          description: "请选择 JSON 或 PNG 格式的角色卡文件",
          variant: "destructive"
        });
        return;
      }

      // 兼容不同版本的角色卡格式
      if (parsedData.spec === "chara_card_v3" || parsedData.spec_version === "3.0") {
        setCharacterData(parsedData);
      } else if (parsedData.spec === "chara_card_v2" || parsedData.data) {
        // V2 格式转换为 V3
        const v3Data: CharacterCardV3 = {
          spec: "chara_card_v3",
          spec_version: "3.0",
          data: {
            name: parsedData.data?.name || parsedData.name || "",
            nickname: parsedData.data?.nickname,
            description: parsedData.data?.description || parsedData.description || "",
            personality: parsedData.data?.personality || parsedData.personality || "",
            scenario: parsedData.data?.scenario || parsedData.scenario || "",
            first_mes: parsedData.data?.first_mes || parsedData.first_mes || "",
            mes_example: parsedData.data?.mes_example || parsedData.mes_example || "",
            creator_notes: parsedData.data?.creator_notes || parsedData.creator_notes || "",
            system_prompt: parsedData.data?.system_prompt || "",
            post_history_instructions: parsedData.data?.post_history_instructions || "",
            alternate_greetings: parsedData.data?.alternate_greetings || [],
            character_book: parsedData.data?.character_book || { entries: [] },
            tags: parsedData.data?.tags || [],
            creator: parsedData.data?.creator || "",
            character_version: parsedData.data?.character_version || "1.0",
            creation_date: new Date().toISOString().split('T')[0],
            modification_date: new Date().toISOString().split('T')[0],
            extensions: parsedData.data?.extensions || {}
          }
        };
        setCharacterData(v3Data);
      } else {
        // V1 格式或其他格式
        const v3Data: CharacterCardV3 = {
          spec: "chara_card_v3",
          spec_version: "3.0",
          data: {
            name: parsedData.name || "",
            description: parsedData.description || "",
            personality: parsedData.personality || "",
            scenario: parsedData.scenario || "",
            first_mes: parsedData.first_mes || "",
            mes_example: parsedData.mes_example || "",
            creator_notes: parsedData.creator_notes || "",
            system_prompt: "",
            post_history_instructions: "",
            alternate_greetings: parsedData.alternate_greetings || [],
            character_book: { entries: [] },
            tags: parsedData.tags || [],
            creator: parsedData.creator || "",
            character_version: "1.0",
            creation_date: new Date().toISOString().split('T')[0],
            modification_date: new Date().toISOString().split('T')[0],
            extensions: {}
          }
        };
        setCharacterData(v3Data);
      }

      toast({
        title: t('importSuccess'),
        description: t('importSuccessDesc'),
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: t('importError') || "导入失败",
        description: file.name.endsWith('.png') 
          ? "此PNG文件中未找到角色卡数据，请确保使用包含角色卡信息的PNG文件"
          : t('importErrorDesc'),
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-purple-900 dark:via-blue-900 dark:to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <Toolbar />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            {t('pageTitle')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-4">
            {t('pageDescription')}
          </p>
          <div className="flex justify-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json,.png"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Upload className="w-4 h-4 mr-2" />
              {t('importCard')}
            </Button>
            <AISettings
              onSettingsChange={handleAISettingsChange}
              currentSettings={aiSettings}
            />
          </div>
        </div>

        {/* 全屏侧边栏选项卡布局 */}
        <div className="flex h-[calc(100vh-180px)] bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg">
          {/* 左侧边栏 */}
          <div className="w-56 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">功能面板</h2>
            </div>
            <nav className="flex-1 p-2">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab("assistant")}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg transition-all duration-200 ${
                    activeTab === "assistant"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Bot className="w-5 h-5" />
                  <span className="font-medium">AI角色卡助手</span>
                </button>
                <button
                  onClick={() => setActiveTab("editor")}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg transition-all duration-200 ${
                    activeTab === "editor"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">角色信息编辑</span>
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg transition-all duration-200 ${
                    activeTab === "preview"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">JSON 预览</span>
                </button>
              </div>
            </nav>
          </div>

          {/* 右侧内容区域 */}
          <div className="flex-1 flex flex-col">
            {/* AI助手面板 */}
            {activeTab === "assistant" && (
              <div className="flex-1 p-6 min-h-0 overflow-auto">
                <AIAssistant
                  aiSettings={aiSettings}
                  onInsertField={handleInsertField}
                />
              </div>
            )}

            {/* 角色信息编辑面板 */}
            {activeTab === "editor" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                    {t('characterInfo')}
                  </h1>
                </div>
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-8">
                      <BasicInfoSection
                        data={characterData.data}
                        updateField={updateField}
                        characterImage={characterImage}
                        setCharacterImage={setCharacterImage}
                        aiSettings={aiSettings}
                      />

                      <PersonalitySection
                        data={characterData.data}
                        updateField={updateField}
                        aiSettings={aiSettings}
                      />

                      <PromptsSection
                        data={characterData.data}
                        updateField={updateField}
                        aiSettings={aiSettings}
                      />

                      <AlternateGreetings
                        greetings={characterData.data.alternate_greetings}
                        updateField={updateField}
                        aiSettings={aiSettings}
                        characterData={characterData.data}
                      />

                      <CharacterBook
                        entries={characterData.data.character_book?.entries || []}
                        updateField={updateField}
                        aiSettings={aiSettings}
                        characterData={characterData.data}
                      />

                      <TagsSection
                        tags={characterData.data.tags}
                        updateField={updateField}
                        aiSettings={aiSettings}
                        characterData={characterData.data}
                      />

                      <MetadataSection
                        data={characterData.data}
                        updateField={updateField}
                      />
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* JSON预览面板 */}
            {activeTab === "preview" && (
              <div className="flex-1 p-6 min-h-0 overflow-auto">
                <CharacterPreview
                  characterData={characterData}
                  characterImage={characterImage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
