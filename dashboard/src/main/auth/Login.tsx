import React, { ChangeEvent, Component } from "react";
import styled from "styled-components";
import logo from "assets/logo.png";
import github from "assets/github-icon.png";
import GoogleIcon from "assets/GoogleIcon";

import api from "shared/api";
import { emailRegex } from "shared/regex";
import { Context } from "shared/Context";

type PropsType = {
  authenticate: () => void;
};

type StateType = {
  email: string;
  password: string;
  emailError: boolean;
  credentialError: boolean;
  hasBasic: boolean;
  hasGithub: boolean;
  hasGoogle: boolean;
  hasResetPassword: boolean;
};

export default class Login extends Component<PropsType, StateType> {
  state = {
    email: "",
    password: "",
    emailError: false,
    credentialError: false,
    hasBasic: true,
    hasGithub: true,
    hasGoogle: false,
    hasResetPassword: true,
  };

  handleKeyDown = (e: any) => {
    e.key === "Enter" ? this.handleLogin() : null;
  };

  componentDidMount() {
    let urlParams = new URLSearchParams(window.location.search);
    let emailFromCLI = urlParams.get("email");
    emailFromCLI
      ? this.setState({ email: emailFromCLI })
      : document.addEventListener("keydown", this.handleKeyDown);

    // get capabilities to case on github
    api
      .getMetadata("", {}, {})
      .then((res) => {
        this.setState({
          hasBasic: res.data?.basic_login,
          hasGithub: res.data?.github_login,
          hasGoogle: res.data?.google_login,
          hasResetPassword: res.data?.email,
        });
      })
      .catch((err) => console.log(err));
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  handleLogin = (): void => {
    let { email, password } = this.state;
    let { authenticate } = this.props;
    let { setUser } = this.context;

    // Check for valid input
    if (!emailRegex.test(email)) {
      this.setState({ emailError: true });
    } else {
      // Attempt user login
      api
        .logInUser(
          "",
          {
            email: email,
            password: password,
          },
          {}
        )
        .then((res) => {
          // TODO: case and set credential error
          if (res?.data?.redirect) {
            window.location.href = res.data.redirect;
          } else {
            setUser(res?.data?.id, res?.data?.email);
            authenticate();
          }
        })
        .catch((err) => this.context.setCurrentError(err.response.data.error));
    }
  };

  renderEmailError = () => {
    let { emailError } = this.state;
    if (emailError) {
      return (
        <ErrorHelper>
          <div />
          Please enter a valid email
        </ErrorHelper>
      );
    }
  };

  renderCredentialError = () => {
    let { credentialError } = this.state;
    if (credentialError) {
      return (
        <ErrorHelper>
          <div />
          Incorrect email or password
        </ErrorHelper>
      );
    }
  };

  githubRedirect = () => {
    let redirectUrl = `/api/oauth/login/github`;
    window.location.href = redirectUrl;
  };

  googleRedirect = () => {
    let redirectUrl = `/api/oauth/login/google`;
    window.location.href = redirectUrl;
  };

  renderGithubSection = () => {
    if (this.state.hasGithub) {
      return (
        <OAuthButton onClick={this.githubRedirect}>
          <IconWrapper>
            <Icon src={github} />
            Log in with GitHub
          </IconWrapper>
        </OAuthButton>
      );
    }
  };

  renderGoogleSection = () => {
    if (this.state.hasGoogle) {
      return (
        <OAuthButton onClick={this.googleRedirect}>
          <IconWrapper>
            <StyledGoogleIcon />
            Log in with Google
          </IconWrapper>
        </OAuthButton>
      );
    }
  };

  renderBasicSection = () => {
    if (this.state.hasBasic) {
      let { email, password, credentialError, emailError } = this.state;

      return (
        <div>
          <InputWrapper>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                this.setState({
                  email: e.target.value,
                  emailError: false,
                  credentialError: false,
                })
              }
              valid={!credentialError && !emailError}
            />
            {this.renderEmailError()}
          </InputWrapper>
          <InputWrapper>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                this.setState({
                  password: e.target.value,
                  credentialError: false,
                })
              }
              valid={!credentialError}
            />
            {this.renderCredentialError()}
          </InputWrapper>
          <Button onClick={this.handleLogin}>Continue</Button>
        </div>
      );
    }
  };

  renderHelper() {
    if (this.state.hasResetPassword) {
      return (
        <Helper>
          <Link href="/register">Sign up</Link> |
          <Link href="/password/reset">Forgot password?</Link>
        </Helper>
      );
    }

    return (
      <Helper>
        <Link href="/register">Sign up</Link>
      </Helper>
    );
  }

  render() {
    return (
      <StyledLogin>
        <LoginPanel
          hasBasic={this.state.hasBasic}
          numOAuth={+this.state.hasGithub + +this.state.hasGoogle}
        >
          <OverflowWrapper>
            <GradientBg />
          </OverflowWrapper>
          <FormWrapper>
            <Logo src={logo} />
            <Prompt>Log in to Porter</Prompt>
            {this.renderGithubSection()}
            {this.renderGoogleSection()}
            {(this.state.hasGithub || this.state.hasGoogle) &&
            this.state.hasBasic ? (
              <OrWrapper>
                <Line />
                <Or>or</Or>
              </OrWrapper>
            ) : null}
            <DarkMatter />
            {this.renderBasicSection()}
            {this.renderHelper()}
          </FormWrapper>
        </LoginPanel>
        <Footer>
          © 2021 Porter Technologies Inc. •
          <Link
            href="https://docs.getporter.dev/docs/terms-of-service"
            target="_blank"
          >
            Terms & Privacy
          </Link>
        </Footer>
      </StyledLogin>
    );
  }
}

Login.contextType = Context;

const Footer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  margin-bottom: 30px;
  width: 100vw;
  text-align: center;
  color: #aaaabb;
  font-size: 13px;
  padding-right: 8px;
  font: Work Sans, sans-serif;
`;

const DarkMatter = styled.div`
  margin-top: -10px;
`;

const Or = styled.div`
  position: absolute;
  width: 30px;
  text-align: center;
  background: #111114;
  z-index: 999;
  left: calc(50% - 15px);
  margin-top: -1px;
`;

const OrWrapper = styled.div`
  display: flex;
  align-items: center;
  color: #ffffff44;
  font-size: 14px;
  position: relative;
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  height: 100%;
`;

const Icon = styled.img`
  height: 18px;
  margin: 0 10px;
`;

const StyledGoogleIcon = styled(GoogleIcon)`
  width: 38px;
  height: 38px;
`;

const OAuthButton = styled.button`
  width: 200px;
  height: 30px;
  border: 0;
  display: flex;
  background: #ffffff;
  align-items: center;
  border-radius: 3px;
  color: #000000;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  font-size: 13px;
  margin: 10px 0;
  overflow: hidden;
  :hover {
    background: #ffffffdd;
  }
`;

const Link = styled.a`
  margin-left: 5px;
  color: #819bfd;
`;

const Helper = styled.div`
  position: absolute;
  bottom: 30px;
  width: 100%;
  text-align: center;
  font-size: 13px;
  font-family: "Work Sans", sans-serif;
  color: #ffffff44;
`;

const OverflowWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 10px;
`;

const ErrorHelper = styled.div`
  position: absolute;
  right: -185px;
  top: 8px;
  height: 30px;
  width: 170px;
  user-select: none;
  background: #272731;
  font-family: "Work Sans", sans-serif;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff3b62;
  border-radius: 3px;

  > div {
    background: #272731;
    height: 15px;
    width: 15px;
    position: absolute;
    left: -3px;
    top: 7px;
    transform: rotate(45deg);
    z-index: -1;
  }
`;

const Line = styled.div`
  min-height: 3px;
  width: 100px;
  z-index: 999;
  background: #ffffff22;
  margin: 30px 0px 30px;
`;

const Button = styled.button`
  width: 200px;
  min-height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: "Work Sans", sans-serif;
  cursor: pointer;
  margin-top: 9px;
  border-radius: 2px;
  border: 0;
  background: #819bfd;
  color: white;
  font-weight: 500;
  font-size: 14px;
`;

const InputWrapper = styled.div`
  position: relative;
`;

const Input = styled.input`
  width: 200px;
  font-family: "Work Sans", sans-serif;
  margin: 8px 0px;
  height: 30px;
  padding: 8px;
  background: #ffffff12;
  color: #ffffff;
  border: ${(props: { valid?: boolean }) =>
    props.valid ? "0" : "1px solid #ff3b62"};
  border-radius: 2px;
  font-size: 14px;
`;

const Prompt = styled.div`
  font-family: "Work Sans", sans-serif;
  font-weight: 500;
  font-size: 15px;
  margin-bottom: 18px;
`;

const Logo = styled.img`
  width: 110px;
  margin-top: 55px;
  margin-bottom: 40px;
  user-select: none;
`;

const FormWrapper = styled.div`
  width: calc(100% - 8px);
  height: calc(100% - 8px);
  background: #111114;
  z-index: 1;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const GradientBg = styled.div`
  background: linear-gradient(#8ce1ff, #a59eff, #fba8ff);
  width: 200%;
  height: 200%;
  position: absolute;
  top: -50%;
  left: -50%;
  animation: flip 6s infinite linear;
  @keyframes flip {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoginPanel = styled.div`
  width: 330px;
  height: ${(props: { numOAuth: number; hasBasic: boolean }) =>
    280 + +props.hasBasic * 150 + props.numOAuth * 50}px;
  background: white;
  margin-top: -20px;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  position: relative;
  align-items: center;
`;

const StyledLogin = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: #111114;
`;
