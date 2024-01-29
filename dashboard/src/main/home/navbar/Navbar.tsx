import React, { Component } from "react";
import styled from "styled-components";
import { Context } from "shared/Context";

import userIcon from "assets/user-icon.png"
import settings from "assets/settings-bold.png";

import Feedback from "./Feedback";
import Help from "./Help";
import { withAuth, WithAuthProps } from "shared/auth/AuthorizationHoc";
import { Select } from "@material-ui/core";

type PropsType = WithAuthProps & {
  logOut: () => void;
  currentView: string;
};

type StateType = {
  showDropdown: boolean;
  currentPolicy: string;
};

class Navbar extends Component<PropsType, StateType> {
  state = {
    showDropdown: false,
    currentPolicy: "admin",
  };

  renderSettingsDropdown = () => {
    if (this.state.showDropdown) {
      let version = this.context?.capabilities?.version;
      let userEmail = this.context.user && this.context.user.email;
      return (
        <>
          <CloseOverlay
            onClick={() => this.setState({ showDropdown: false })}
          />
          <Dropdown dropdownWidth="250px" dropdownMaxHeight="200px">
            <DropdownLabel>{userEmail}</DropdownLabel>
            <UserDropdownButton
              onClick={() =>
                this.context.setCurrentModal("AccountSettingsModal", {})
              }
            >
              <SettingsIcon>
                <Icon src={settings} />
              </SettingsIcon>
              Account settings
            </UserDropdownButton>
            <UserDropdownButton onClick={this.props.logOut}>
              <i className="material-icons">keyboard_return</i> Log out
              {version !== "production" && <VersionTag>{version}</VersionTag>}
            </UserDropdownButton>
          </Dropdown>
        </>
      );
    }
  };

  renderFeedbackButton = () => {
    return <Feedback currentView={this.props.currentView} />;
  };

  render() {
    return (
      <StyledNavbar>
        <Help />
        <NavButton
          selected={this.state.showDropdown}
          onClick={() =>
            this.setState({ showDropdown: !this.state.showDropdown })
          }
        >
          <Img src={userIcon} selected={this.state.showDropdown} />
          {this.renderSettingsDropdown()}
        </NavButton>
      </StyledNavbar>
    );
  }
}

Navbar.contextType = Context;

export default withAuth(Navbar);

const Icon = styled.img`
  height: 15px;
  margin-right: 10px;
  opacity: 0.6;
  margin-bottom: -3px;
`;

const VersionTag = styled.div`
  position: absolute;
  right: 10px;
  top: 15px;
  color: #ffffff22;
`;

const SettingsIcon = styled.div`
  > i {
    background: none;
    border-radius: 3px;
    display: flex;
    font-size: 15px;
    top: 11px;
    margin-right: 10px;
    padding: 1px;
    align-items: center;
    justify-content: center;
    color: #ffffffaa;
    border: 0;
  }
`;

const I = styled.i`
  margin-right: 7px;
`;

const Img = styled.img<{ selected: boolean }>`
  height: 16px;
  opacity: ${props => props.selected ? "1" : "0.6"};
  margin-right: 10px; 
  border-radius: 5px;
  :hover {
    opacity: 1;
  }
`;

const CloseOverlay = styled.div`
  position: fixed;
  width: 100vw;
  height: 100vh;
  z-index: 100;
  top: 0;
  left: 0;
  cursor: default;
`;

const UserDropdownButton = styled.button`
  padding: 13px;
  position: relative;
  height: 40px;
  font-size: 13px;
  font-family: "Work Sans", sans-serif;
  color: #ffffff88;
  width: 100%;
  border: 0;
  text-align: left;
  background: none;
  cursor: ${(props) => (!props.disabled ? "pointer" : "default")};
  user-select: none;
  :focus {
    outline: 0;
  }
  :hover {
    color: #fff;
    > i {
      color: #fff;
      border: 1px solid #fff;
    }
    > div {
      > img {
        opacity: 100%;
      }
    }
  }
  display: flex;
  align-items: center;

  > i {
    background: none;
    border-radius: 3px;
    display: flex;
    font-size: 13px;
    top: 11px;
    margin-right: 10px;
    padding: 1px;
    align-items: center;
    justify-content: center;
    color: #ffffffaa;
    border: 1px solid #ffffffaa;
  }
`;

const DropdownLabel = styled.div`
  font-size: 13px;
  height: 40px;
  color: #ffffff44;
  padding: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const Dropdown = styled.div`
  position: absolute;
  right: 0;
  top: calc(100% + 15px);
  background: #121212;
  width: ${(props: {
    dropdownWidth: string;
    dropdownMaxHeight: string;
    feedbackSent?: boolean;
  }) => props.dropdownWidth};
  max-height: ${(props: {
    dropdownWidth: string;
    dropdownMaxHeight: string;
    feedbackSent?: boolean;
  }) => (props.dropdownMaxHeight ? props.dropdownMaxHeight : "300px")};
  border-radius: 5px;
  z-index: 999;
  border: 1px solid #494B4F;
  overflow-y: auto;
  margin-bottom: 20px;
  animation: ${(props: {
    dropdownWidth: string;
    dropdownMaxHeight: string;
    feedbackSent?: boolean;
  }) => (props.feedbackSent ? "flyOff 0.3s 0.05s" : "")};
  animation-fill-mode: forwards;
  @keyframes flyOff {
    from {
      opacity: 1;
      transform: translateX(0px);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;

const StyledNavbar = styled.div`
  height: 50px;
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 2;
`;

const NavButton = styled.a`
  display: flex;
  position: relative;
  align-items: center;
  font-size: 14px;
  color: #ffffff88;
  cursor: pointer;
  justify-content: center;
  margin-right: 10px;
  :hover {
    > i {
      color: #ffffff;
    }
    color: #ffffff;
  }

  > i {
    cursor: pointer;
    color: ${(props: { selected?: boolean }) =>
      props.selected ? "#ffffff" : "#ffffff88"};
    font-size: 20px;
  }
`;