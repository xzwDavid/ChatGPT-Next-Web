import { IconButton } from "./button";
import { ErrorBoundary } from "./error";

import styles from "./mask.module.scss";

import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import EditIcon from "../icons/edit.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import DeleteIcon from "../icons/delete.svg";
import EyeIcon from "../icons/eye.svg";
import CopyIcon from "../icons/copy.svg";
import RobotIcon from "../icons/rename.svg";

import { DEFAULT_MASK_AVATAR, Mask, useMaskStore } from "../store/mask";
import { ChatMessage, ModelConfig, useAppConfig, useChatStore } from "../store";
import { ROLES } from "../client/api";
import { Input, List, ListItem, Modal, Popover, Select } from "./ui-lib";
import { Avatar, AvatarPicker } from "./emoji";
import Locale, { AllLangs, ALL_LANG_OPTIONS, Lang } from "../locales";
import { useLocation, useNavigate } from "react-router-dom";

import chatStyle from "./chat.module.scss";
import { useEffect, useState } from "react";
import { downloadAs, readFromFile } from "../utils";
import { Updater } from "../typing";
import { ModelConfigList } from "./model-config";
import { FileName, Path } from "../constant";
import { BUILTIN_MASK_STORE } from "../masks";

export function RulesConfig(props: {
  extraListItems?: JSX.Element;
  readonly?: boolean;
  shouldSyncFromGlobal?: boolean;
}) {
  return (
    <>
      <List>
        <ListItem
          title={Locale.Mask.Config.HideContext.Title}
          subTitle={Locale.Mask.Config.HideContext.SubTitle}
        >
          <input
            type="checkbox"
            //checked={}
            onChange={(e) => {
              //  alert("hhh");
            }}
          ></input>
        </ListItem>
      </List>
    </>
  );
}
