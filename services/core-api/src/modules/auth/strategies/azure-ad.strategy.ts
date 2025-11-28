import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OIDCStrategy } from 'passport-azure-ad';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class AzureAdStrategy extends PassportStrategy(OIDCStrategy, 'azure-ad') {
    constructor(
        configService: ConfigService,
        private authService: AuthService,
    ) {
        const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
        const redirectUrl = configService.get('AZURE_REDIRECT_URL') || 'http://localhost:3001/auth/azure/callback';
        const isProduction = nodeEnv === 'production';

        // Only allow HTTP redirects in development
        // In production, HTTPS is required for security
        const allowHttp = !isProduction;

        super({
            identityMetadata: `https://login.microsoftonline.com/${configService.get('AZURE_TENANT_ID')}/v2.0/.well-known/openid-configuration`,
            clientID: configService.get('AZURE_CLIENT_ID'),
            responseType: 'code id_token',
            responseMode: 'form_post',
            redirectUrl: redirectUrl,
            allowHttpForRedirectUrl: allowHttp,
            clientSecret: configService.get('AZURE_CLIENT_SECRET'),
            validateIssuer: false, // Allow any tenant (multi-tenant app) or specific tenant
            passReqToCallback: false,
            scope: ['email', 'profile', 'openid'],
            loggingLevel: isProduction ? 'warn' : 'info',
            nonceLifetime: null,
            nonceMaxAmount: 5,
            useCookieInsteadOfSession: false,
            cookieEncryptionKeys: null,
        });
    }

    async validate(_iss: string, sub: string, profile: any, _jwtClaims: any, _accessToken: string, _refreshToken: string, _params: any) {
        // profile contains the user info from Azure AD
        // We need to find or create the user in our DB
        try {
            const user = await this.authService.validateAzureUser({
                oid: profile.oid || sub,
                email: profile.upn || profile.email, // upn is usually the email in Azure AD
                firstName: profile.name?.split(' ')[0] || profile.given_name || '',
                lastName: profile.name?.split(' ').slice(1).join(' ') || profile.family_name || '',
            });

            if (!user) {
                throw new UnauthorizedException('Access denied');
            }
            return user;
        } catch (error) {
            throw new UnauthorizedException('Authentication failed');
        }
    }
}
