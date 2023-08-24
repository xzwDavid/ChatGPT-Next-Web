import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Document } from "langchain/document";
import { trimTopic } from "../utils";

import Locale from "../locales";
import { showToast } from "../components/ui-lib";
import { ModelConfig, ModelType } from "./config";
import { createEmptyMask, Mask, useMaskStore } from "./mask";
import { StoreKey } from "../constant";
import { api, RequestMessage } from "../client/api";
import { ChatControllerPool } from "../client/controller";
import { prettyObject } from "../utils/format";
import { useState } from "react";
import { useAccessStore } from "@/app/store/access";

export type ChatMessage = RequestMessage & {
  date: string;
  streaming?: boolean;
  isError?: boolean;
  id?: number;
  model?: ModelType;
  sourceDocs?: Document[];
  origin_answer?: string;
  comment?: string;
  iscomment?: boolean;
};

export interface Masks {
  id?: number;
  isUser?: boolean;
  title: string;
  content: string;
}

export function createMessage(override: Partial<ChatMessage>): ChatMessage {
  return {
    id: Date.now(),
    date: new Date().toLocaleString(),
    role: "user",
    content: "",

    maskId: 0,

    ...override,
  };
}

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: number;
  topic: string;

  memoryPrompt: string;
  messages: ChatMessage[];
  stat: ChatStat;
  lastUpdate: number;
  lastSummarizeIndex: number;
  clearContextIndex?: number;

  mask: Mask;
  group: boolean;
  fileUploaded: string[];
  groupMem: number;
  maskId: number[];
  groupSpeed?: number;
}

export const DEFAULT_TOPIC = Locale.Store.DefaultTopic;
export const BOT_HELLO: ChatMessage = createMessage({
  role: "assistant",
  content: Locale.Store.BotHello,
});

export const BOT_Group: ChatMessage = createMessage({
  role: "assistant",
  content: Locale.Store.GroupDefault,
});

function createEmptySession(): ChatSession {
  const val = Date.now() + Math.random();
  return {
    id: val,
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,
    fileUploaded: [],
    mask: createEmptyMask(),
    group: false,
    groupMem: 0,
    maskId: [],
  };
}
function createEmptySessions(): ChatSession {
  //  alert("group");
  //比原函数多加s，区分创建群聊

  return {
    clearContextIndex: 0,
    fileUploaded: [],
    id: Date.now() + Math.random(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,
    mask: createEmptyMask(),
    group: true,
    groupMem: 0,
    maskId: [],
    groupSpeed: 0,
  };
}
interface ChatStore {
  user_name: string;
  inputContent: string;
  sessions: ChatSession[];
  currentSessionIndex: number;
  globalId: number;
  clearSessions: () => void;
  moveSession: (from: number, to: number) => void;
  selectSession: (index: number) => void;
  newSession: (mask?: Mask) => void;
  newSessions: (mask?: Mask) => void;
  deleteSession: (index: number) => void;
  currentSession: () => ChatSession;
  onNewMessage: (message: ChatMessage) => void;
  onUserInput: (
    content: string | ChatMessage[],
    maskId: number,
    isGroup?: boolean,
    isRule1?: boolean,
    setResponse?: React.Dispatch<React.SetStateAction<string>>,
    setTempMessages?: React.Dispatch<React.SetStateAction<string[]>>,
    modelConf?: ModelConfig,
  ) => Promise<void>;
  summarizeSession: () => void;
  updateStat: (message: ChatMessage) => void;
  updateCurrentSession: (updater: (session: ChatSession) => void) => void;
  updateNum: (updater: (session: ChatSession) => void) => void;
  updateSpeed: (updater: (session: ChatSession) => void) => void;
  updateMessage: (
    sessionIndex: number,
    messageIndex: number,
    updater: (message?: ChatMessage) => void,
  ) => void;
  resetSession: () => void;
  getMessagesWithMemory: () => ChatMessage[];
  getMemoryPrompt: () => ChatMessage;

  clearAllData: () => void;

  pushMaskId: (id: number) => void;
  // createContent:(content:string)=>ChatMessage;
  // createSystemInfo:(content:string)=>void;
}

function countMessages(msgs: ChatMessage[]) {
  return msgs.reduce((pre, cur) => pre + cur.content.length, 0);
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [createEmptySession()],
      currentSessionIndex: 0,
      globalId: 0,
      inputContent: "",
      user_name: "xzw",
      SystemInfos: [],

      clearSessions() {
        set(() => ({
          sessions: [createEmptySession()],
          currentSessionIndex: 0,
        }));
      },

      pushMaskId(id) {
        get().updateCurrentSession((session) => {
          session.maskId.push(id);
        });
      },

      selectSession(index: number) {
        set({
          currentSessionIndex: index,
        });
      },

      moveSession(from: number, to: number) {
        set((state) => {
          const { sessions, currentSessionIndex: oldIndex } = state;

          // move the session
          const newSessions = [...sessions];
          const session = newSessions[from];
          newSessions.splice(from, 1);
          newSessions.splice(to, 0, session);

          // modify current session id
          let newIndex = oldIndex === from ? to : oldIndex;
          if (oldIndex > from && oldIndex <= to) {
            newIndex -= 1;
          } else if (oldIndex < from && oldIndex >= to) {
            newIndex += 1;
          }

          return {
            currentSessionIndex: newIndex,
            sessions: newSessions,
          };
        });
      },

      newSession(mask) {
        const session = createEmptySession();

        set(() => ({ globalId: get().globalId + 1 }));
        //ssession.id = get().globalId;

        if (mask) {
          session.mask = { ...mask };
          session.topic = mask.name;
        }

        set((state) => ({
          currentSessionIndex: 0,
          sessions: [session].concat(state.sessions),
        }));
      },

      newSessions(mask) {
        //    alert("ll")
        const session = createEmptySessions();
        //        alert(session.id)
        //      alert("llllllll")

        set(() => ({ globalId: get().globalId + 1 }));
        //  alert(session.id);
        //session.id = get().globalId;

        if (mask) {
          session.mask = { ...mask };
          session.topic = mask.name;
        }

        set((state) => ({
          currentSessionIndex: 0,
          sessions: [session].concat(state.sessions),
        }));
      },

      deleteSession(index) {
        const deletingLastSession = get().sessions.length === 1;
        const deletedSession = get().sessions.at(index);

        if (!deletedSession) return;

        const sessions = get().sessions.slice();
        sessions.splice(index, 1);

        const currentIndex = get().currentSessionIndex;
        let nextIndex = Math.min(
          currentIndex - Number(index < currentIndex),
          sessions.length - 1,
        );

        if (deletingLastSession) {
          nextIndex = 0;
          sessions.push(createEmptySession());
        }

        // for undo delete action
        const restoreState = {
          currentSessionIndex: get().currentSessionIndex,
          sessions: get().sessions.slice(),
        };

        set(() => ({
          currentSessionIndex: nextIndex,
          sessions,
        }));

        showToast(
          Locale.Home.DeleteToast,
          {
            text: Locale.Home.Revert,
            onClick() {
              set(() => restoreState);
            },
          },
          5000,
        );
      },

      currentSession() {
        let index = get().currentSessionIndex;
        const sessions = get().sessions;

        if (index < 0 || index >= sessions.length) {
          index = Math.min(sessions.length - 1, Math.max(0, index));
          set(() => ({ currentSessionIndex: index }));
        }

        const session = sessions[index];
        //alert("Here " + session.id.toString())
        return session;
      },

      onNewMessage(message) {
        get().updateCurrentSession((session) => {
          session.lastUpdate = Date.now();
        });
        get().updateStat(message);
        //  get().summarizeSession();
        const msg = get().currentSession().messages;
        const content = msg[msg.length - 1].content;
        //console.log("[The msg is ]"+content);
      },

      //  createContent(content){
      //     const systemInfo = createMessage({
      //       role: "system",
      //       content:content,
      //     })
      //     return systemInfo;
      //  },
      //  createSystemInfo(content){

      //     const systemInfo = get().createContent(content);
      //      get().SystemInfos.push(systemInfo);
      //     console.log(get().SystemInfos.length)
      //     console.log(get().SystemInfos[0])
      //  },
      async onUserInput(
        content: string | ChatMessage[],
        maskId: number,
        isGroup?: boolean,
        isRule1?: boolean,
        setResponse?: React.Dispatch<React.SetStateAction<string>>,
        setTempMessages?: React.Dispatch<React.SetStateAction<string[]>>,
        modelConf?: ModelConfig,
      ) {
        const process_text = (input: string): string[] => {
          // 使用正则表达式来匹配数字点后面的内容，并支持换行符
          const regex = /(\d+)\.(.*?)(?:\n|$)/g;

          const matches = input.match(regex);

          if (matches) {
            // 去除匹配结果中的点号和换行符并返回
            return matches.map((match) => match.replace(/[\.\n]/g, "").trim());
          } else {
            return [];
          }
        };

        if (isRule1 && typeof content === "string") {
          const session = get().currentSession();
          //const masks = useMaskStore
          let modelConfig;
          if (!modelConf) {
            modelConfig = session.mask.modelConfig;
          } else {
            modelConfig = modelConf;
            // alert(modelConfig.model);
          }

          //alert(modelConfig.model)
          const userMessage: ChatMessage = createMessage({
            role: "user",
            content: content,
          });

          const botMessage: ChatMessage = createMessage({
            role: "assistant",
            streaming: true,
            id: userMessage.id! + 1,
            model: modelConfig.model,
          });
          const botMessage_push: ChatMessage = createMessage({
            role: "assistant",
            streaming: false,
            id: userMessage.id! + 1,
            model: modelConfig.model,
          });

          const systemInfo = createMessage({
            role: "system",
            content: `IMPORTANT: You are a virtual assistant powered by the ${
              modelConfig.model
            } model, now time is ${new Date().toLocaleString()}}`,
            id: botMessage_push.id! + 1,
          });

          // get recent messages
          const systemMessages = [];
          // if user define a mask with context prompts, wont send system info
          if (session.mask.context.length === 0) {
            systemMessages.push(systemInfo);
          }

          const recentMessages = get().getMessagesWithMemory();
          console.log("[recentMessage", recentMessages);
          const sendMessages = systemMessages.concat(
            recentMessages.concat(userMessage),
          );

          console.log("[SendMessage is] : ", sendMessages);
          const sessionIndex = get().currentSessionIndex;
          const messageIndex = get().currentSession().messages.length + 1;

          get().updateCurrentSession((session) => {
            session.messages.push(userMessage);
            session.messages.push(botMessage_push);
          });

          let isStreaming = true;
          //alert(modelConfig.model);
          if (modelConfig.model === "lang chain(Upload your docs)") {
            isStreaming = false;
          }

          //alert(isStreaming)
          // make request
          console.log("[User Input] ", sendMessages);
          const chat = get().currentSession();

          //const chat_id = get().globalId
          //alert(chat_id);
          const uuid = chat.id;
          //alert(uuid);

          let prompt = "";

          for (let i = chat.messages.length - 1; i >= 0; i--) {
            if (chat.messages[i].role === "assistant") {
              prompt = chat.mask?.context[0]?.content;
              //alert(prompt);
              break;
            }
          }
          console.log("The config is ", modelConfig);
          //const accessStore = useAccessStore();

          api.llm.chat({
            uuid: uuid,
            group: session.group,
            name: this.user_name,
            agent_name: session.mask.name,
            messages: sendMessages,
            config: { ...modelConfig, stream: isStreaming },
            prompt: prompt,
            onUpdate(message) {
              botMessage.streaming = true;
              if (message) {
                botMessage.content = message;
              }
              set(() => ({}));
            },
            onFinish(message, sourceDocs?) {
              //alert("triggered1!!");
              botMessage.streaming = false;
              //alert(botMessage.content);
              if (message) {
                botMessage.content = message;
                botMessage.origin_answer = message;
                if (setResponse) {
                  setResponse(message);
                }

                if (setTempMessages) {
                  const temp = process_text(message);

                  console.log("The temp is ", temp);
                  if (temp.length > 3) {
                    setTempMessages(temp);
                  }
                  const addinfo1 =
                    "I will answer your question step by step. \n";
                  const addinfo2 =
                    "\n If you have any question about this step, please ask me directly. If not, please input '1'.";
                  botMessage_push.content = addinfo1 + temp[0] + addinfo2;
                  botMessage_push.streaming = false;
                }

                if (sourceDocs) {
                  botMessage_push.sourceDocs = sourceDocs;
                }

                get().onNewMessage(botMessage);
              }

              ChatControllerPool.remove(
                sessionIndex,
                botMessage.id ?? messageIndex,
              );
              set(() => ({}));
            },
            onError(error) {
              const isAborted = error.message.includes("aborted");
              botMessage.content =
                "\n\n" +
                prettyObject({
                  error: true,
                  message: error.message,
                });
              botMessage.streaming = false;
              userMessage.isError = !isAborted;
              botMessage.isError = !isAborted;

              set(() => ({}));
              ChatControllerPool.remove(
                sessionIndex,
                botMessage.id ?? messageIndex,
              );

              console.error("[Chat] failed ", error);
            },
            onController(controller) {
              // collect controller for stop/retry
              ChatControllerPool.addController(
                sessionIndex,
                botMessage.id ?? messageIndex,
                controller,
              );
            },
          });

          //alert("oooo");
          return;
        }

        if (typeof content === "string") {
          const session = get().currentSession();
          //const modelConfig = session.mask.modelConfig;
          let modelConfig;
          if (!modelConf) {
            modelConfig = session.mask.modelConfig;
          } else {
            modelConfig = modelConf;
            //alert(modelConfig.model);
          }

          //alert(modelConfig.model)
          const userMessage: ChatMessage = createMessage({
            role: "user",
            content: content,
          });

          const botMessage: ChatMessage = createMessage({
            role: "assistant",
            streaming: true,
            id: userMessage.id! + 1,
            model: modelConfig.model,
          });

          const systemInfo = createMessage({
            role: "system",
            content: `IMPORTANT: You are a virtual assistant powered by the ${
              modelConfig.model
            } model, now time is ${new Date().toLocaleString()}}`,
            id: botMessage.id! + 1,
          });

          // get recent messages
          const systemMessages = [];
          // if user define a mask with context prompts, wont send system info
          if (session.mask.context.length === 0) {
            //alert("hhhhh")
            systemMessages.push(systemInfo);
          }

          const recentMessages = get().getMessagesWithMemory();
          console.log("[recentMessage", recentMessages);
          const sendMessages = systemMessages.concat(
            recentMessages.concat(userMessage),
          );

          console.log("[SendMessage is] : ", sendMessages);
          const sessionIndex = get().currentSessionIndex;
          const messageIndex = get().currentSession().messages.length + 1;

          // save user's and bot's message
          get().updateCurrentSession((session) => {
            session.messages.push(userMessage);
            session.messages.push(botMessage);
          });
          let isStreaming = true;
          //alert(modelConfig.model);
          if (modelConfig.model === "lang chain(Upload your docs)") {
            isStreaming = false;
          }

          //alert(isStreaming)
          // make request
          console.log("[User Input] ", sendMessages);
          const chat = get().currentSession();

          //const chat_id = get().globalId
          //alert(chat_id);
          console.log("Here hhhhh", chat);

          const uuid =
            chat.mask.uuid_mask === -1 ? chat.id : chat.mask.uuid_mask;

          let prompt = "";
          for (let i = chat.messages.length - 1; i >= 0; i--) {
            if (chat.messages[i].role === "assistant") {
              prompt = chat.mask?.context[0]?.content;
              //alert(prompt);
              break;
            }
          }
          console.log("The config is ", modelConfig);
          //          alert("here")
          api.llm.chat({
            uuid: uuid,
            group: session.group,
            name: this.user_name,
            messages: sendMessages,
            agent_name: session.mask.name,
            config: { ...modelConfig, stream: isStreaming },
            prompt: prompt,
            onUpdate(message) {
              botMessage.streaming = true;
              if (message) {
                botMessage.content = message;
              }
              set(() => ({}));
            },
            onFinish(message, sourceDocs?) {
              //alert("triggered1!!");
              botMessage.streaming = false;
              //alert(botMessage.content);
              if (message) {
                botMessage.content = message;
                botMessage.origin_answer = message;

                if (sourceDocs) {
                  botMessage.sourceDocs = sourceDocs;
                }

                get().onNewMessage(botMessage);
              }

              ChatControllerPool.remove(
                sessionIndex,
                botMessage.id ?? messageIndex,
              );
              set(() => ({}));
            },
            onError(error) {
              const isAborted = error.message.includes("aborted");
              botMessage.content =
                "\n\n" +
                prettyObject({
                  error: true,
                  message: error.message,
                });
              botMessage.streaming = false;
              userMessage.isError = !isAborted;
              botMessage.isError = !isAborted;

              set(() => ({}));
              ChatControllerPool.remove(
                sessionIndex,
                botMessage.id ?? messageIndex,
              );

              console.error("[Chat] failed ", error);
            },
            onController(controller) {
              // collect controller for stop/retry
              ChatControllerPool.addController(
                sessionIndex,
                botMessage.id ?? messageIndex,
                controller,
              );
            },
          });
        } else {
          const session = get().currentSession();
          let modelConfig;
          if (!modelConf) {
            modelConfig = session.mask.modelConfig;
          } else {
            modelConfig = modelConf;
            //alert(modelConfig.model);
          }

          //const question = content[content.length - 1].content;
          //alert(modelConfig.model)

          const botMessage: ChatMessage = createMessage({
            role: "assistant",
            streaming: true,
            model: modelConfig.model,
          });

          const systemInfo = createMessage({
            role: "system",
            content: `IMPORTANT: You are a virtual assistant powered by the ${
              modelConfig.model
            } model, now time is ${new Date().toLocaleString()}}`,
          });

          // get recent messages
          const systemMessages = [];

          if (session.mask.context.length === 0) {
            systemMessages.push(systemInfo);
          }

          // const recentMessages = get().getMessagesWithMemory();
          // console.log("[recentMessage", recentMessages);
          // const sendMessages = systemMessages.concat(
          //   recentMessages.concat(userMessage),
          // );

          console.log("[SendMessage is] : ", content);
          const sessionIndex = get().currentSessionIndex;
          const messageIndex = get().currentSession().messages.length + 1;
          console.log("[messageIndex] : ", messageIndex);

          get().updateCurrentSession((session) => {
            session.messages.push(botMessage);
          });
          //});
          let isStreaming = true;
          //alert(modelConfig.model);
          if (modelConfig.model === "lang chain(Upload your docs)") {
            isStreaming = false;
          }
          isStreaming = false;

          const chat = get().currentSession();
          //const uuid = chat.id;
          const uuid =
            chat.mask?.uuid_mask === -1 ? chat.id : chat.mask?.uuid_mask;
          let prompt = "";
          for (let i = chat.messages.length - 1; i >= 0; i--) {
            if (chat.messages[i].role === "assistant") {
              prompt = chat.mask.avatar;
              //alert(prompt);
              break;
            }
          }
          console.log("XZW   The config is ", modelConfig);
          api.llm.chat({
            uuid: uuid,
            group: session.group,
            name: this.user_name,
            messages: content,
            prompt: prompt,
            agent_name: session.mask.name,
            config: { ...modelConfig, stream: isStreaming },
            onUpdate(message) {
              botMessage.streaming = true;
              if (message) {
                botMessage.content = message;
              }
              set(() => ({}));
            },
            onFinish(message, sourceDocs?) {
              //alert("triggered!!");
              set((state) => ({
                ...state,
                inputContent: message, // 更新 inputContent 的值
              }));
              botMessage.streaming = false;
              //console.log("修改maskid之前的聊天记录",session.messages);
              //alert("The maskId is " + maskId.toString());
              botMessage.maskId = maskId;
              //console.log("修改maskid之后的聊天记录",session.messages);
              if (message) {
                botMessage.content = message;
                //here is

                if (sourceDocs) {
                  botMessage.sourceDocs = sourceDocs;
                }

                get().onNewMessage(botMessage);
              }
              ChatControllerPool.remove(
                sessionIndex,
                botMessage.id ?? messageIndex,
              );
              set(() => ({}));
            },
            onError(error) {
              const isAborted = error.message.includes("aborted");
              botMessage.content =
                "\n\n" +
                prettyObject({
                  error: true,
                  message: error.message,
                });
              botMessage.streaming = false;
              //userMessage.isError = !isAborted;
              botMessage.isError = !isAborted;

              set(() => ({}));
              ChatControllerPool.remove(
                sessionIndex,
                botMessage.id ?? messageIndex,
              );

              console.error("[Chat] failed ", error);
            },
            onController(controller) {
              // collect controller for stop/retry
              ChatControllerPool.addController(
                sessionIndex,
                botMessage.id ?? messageIndex,
                controller,
              );
            },
          });
        }
      },

      getMemoryPrompt() {
        const session = get().currentSession();

        return {
          role: "system",
          content:
            session.memoryPrompt.length > 0
              ? Locale.Store.Prompt.History(session.memoryPrompt)
              : "",
          date: "",
        } as ChatMessage;
      },

      getMessagesWithMemory() {
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;

        // wont send cleared context messages
        const clearedContextMessages = session.messages.slice(
          session.clearContextIndex ?? 0,
        );
        const messages = clearedContextMessages.filter((msg) => !msg.isError);
        const n = messages.length;

        const context = session.mask.context.slice();

        // long term memory
        if (
          modelConfig.sendMemory &&
          session.memoryPrompt &&
          session.memoryPrompt.length > 0
        ) {
          const memoryPrompt = get().getMemoryPrompt();
          context.push(memoryPrompt);
        }

        // get short term and unmemoried long term memory
        const shortTermMemoryMessageIndex = Math.max(
          0,
          n - modelConfig.historyMessageCount,
        );
        const longTermMemoryMessageIndex = session.lastSummarizeIndex;
        const mostRecentIndex = Math.max(
          shortTermMemoryMessageIndex,
          longTermMemoryMessageIndex,
        );
        const threshold = modelConfig.compressMessageLengthThreshold * 2;

        // get recent messages as many as possible
        const reversedRecentMessages = [];
        for (
          let i = n - 1, count = 0;
          i >= mostRecentIndex && count < threshold;
          i -= 1
        ) {
          const msg = messages[i];
          if (!msg || msg.isError) continue;
          count += msg.content.length;
          reversedRecentMessages.push(msg);
        }

        // concat
        const recentMessages = context.concat(reversedRecentMessages.reverse());

        return recentMessages;
      },

      updateMessage(
        sessionIndex: number,
        messageIndex: number,
        updater: (message?: ChatMessage) => void,
      ) {
        const sessions = get().sessions;
        const session = sessions.at(sessionIndex);
        const messages = session?.messages;
        updater(messages?.at(messageIndex));
        set(() => ({ sessions }));
      },

      resetSession() {
        get().updateCurrentSession((session) => {
          session.messages = [];
          session.memoryPrompt = "";
        });
      },

      summarizeSession() {
        const session = get().currentSession();

        // remove error messages if any
        const messages = session.messages;

        // should summarize topic after chating more than 50 words
        const SUMMARIZE_MIN_LEN = 50;
        if (
          session.topic === DEFAULT_TOPIC &&
          countMessages(messages) >= SUMMARIZE_MIN_LEN
        ) {
          const topicMessages = messages.concat(
            createMessage({
              role: "user",
              content: Locale.Store.Prompt.Topic,
            }),
          );
          console.log("[topicMessage] : ", topicMessages);
          const uuid = session.id;

          api.llm.chat({
            prompt: "",
            uuid: uuid,
            group: session.group,
            name: this.user_name,
            agent_name: session.mask.name,
            messages: topicMessages,
            config: {
              model: "gpt-3.5-turbo",
            },
            onFinish(message) {
              //alert("triggered3!!");
              get().updateCurrentSession(
                (session) =>
                  (session.topic =
                    message.length > 0 ? trimTopic(message) : DEFAULT_TOPIC),
              );
            },
          });
        }

        const modelConfig = session.mask.modelConfig;
        const summarizeIndex = Math.max(
          session.lastSummarizeIndex,
          session.clearContextIndex ?? 0,
        );
        let toBeSummarizedMsgs = messages
          .filter((msg) => !msg.isError)
          .slice(summarizeIndex);

        const historyMsgLength = countMessages(toBeSummarizedMsgs);

        if (historyMsgLength > modelConfig?.max_tokens ?? 4000) {
          const n = toBeSummarizedMsgs.length;
          toBeSummarizedMsgs = toBeSummarizedMsgs.slice(
            Math.max(0, n - modelConfig.historyMessageCount),
          );
        }

        // add memory prompt
        toBeSummarizedMsgs.unshift(get().getMemoryPrompt());

        const lastSummarizeIndex = session.messages.length;

        console.log(
          "[Chat History] ",
          toBeSummarizedMsgs,
          historyMsgLength,
          modelConfig.compressMessageLengthThreshold,
        );
        const message =
          toBeSummarizedMsgs[toBeSummarizedMsgs.length - 1].content;
        //console.log("xzw want" + message);

        if (
          historyMsgLength > modelConfig.compressMessageLengthThreshold &&
          modelConfig.sendMemory
        ) {
          const uuid = session.id;
          //alert("33333");
          api.llm.chat({
            uuid: uuid,
            group: session.group,
            name: this.user_name,
            agent_name: session.mask.name,
            prompt: "",
            messages: toBeSummarizedMsgs.concat({
              role: "system",
              content: Locale.Store.Prompt.Summarize,
              date: "",

              maskId: 0,
            }),
            config: { ...modelConfig, stream: true },
            onUpdate(message) {
              session.memoryPrompt = message;
            },
            onFinish(message) {
              //alert("triggered4!!");
              console.log("[Memory] ", message);
              session.lastSummarizeIndex = lastSummarizeIndex;
            },
            onError(err) {
              console.error("[Summarize] ", err);
            },
          });
        }
      },

      updateStat(message) {
        get().updateCurrentSession((session) => {
          session.stat.charCount += message.content.length;
          // TODO: should update chat count and word count
        });
      },

      updateCurrentSession(updater) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },
      updateNum(updater) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },
      updateSpeed(updater) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },

      clearAllData() {
        localStorage.clear();
        location.reload();
      },
    }),
    {
      name: StoreKey.Chat,
      version: 2,
      migrate(persistedState, version) {
        const state = persistedState as any;
        const newState = JSON.parse(JSON.stringify(state)) as ChatStore;

        if (version < 2) {
          newState.globalId = Date.now() + Math.random();
          newState.sessions = [];

          const oldSessions = state.sessions;
          for (const oldSession of oldSessions) {
            const newSession = createEmptySession();
            newSession.topic = oldSession.topic;
            newSession.messages = [...oldSession.messages];
            newSession.mask.modelConfig.sendMemory = true;
            newSession.mask.modelConfig.historyMessageCount = 4;
            newSession.mask.modelConfig.compressMessageLengthThreshold = 1000;
            newState.sessions.push(newSession);
          }
        }

        return newState;
      },
    },
  ),
);
